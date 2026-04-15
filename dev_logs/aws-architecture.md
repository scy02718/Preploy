> **Status: PARKED as of 2026-04-15.**
>
> This document describes the target AWS architecture for migrating Preploy
> off Vercel + Supabase. As of 2026-04-15 the migration is **parked** in favor
> of pre-launch feature + marketing work. Vercel Hobby + Supabase free tier
> are genuinely sufficient for current usage, and the ~$23/mo + ~30 hours
> that a migration would cost is better spent on landing page, SEO, billing,
> and remaining feature work.
>
> **Revival triggers** — reopen epic [#19](https://github.com/scy02718/interview-assistant/issues/19) when any of the following holds:
>
> - Vercel bandwidth crosses **60 GB** in a single month (60% of the 100 GB Hobby free tier)
> - Supabase database size crosses **350 MB** (70% of the 500 MB free tier)
> - A feature needs background work longer than **300 s** (Vercel function timeout)
> - Monthly active users crosses **~500**
>
> **When revived, re-verify AWS pricing** — the $ figures in §8 are as of
> 2026-04 and drift. Sub-issues #21–#30 remain open but stale and should not
> be worked on without explicit instruction.
>
> **Note on cost:** §8 below reflects the original always-on design at
> ~$45.91/mo. During the parking discussion on #19, a scheduled-wake/sleep
> variant (ALB always-on, Fargate + RDS started on demand via GitHub Actions
> `workflow_dispatch`, nightly auto-sleep, weekly RDS keep-alive Lambda to
> reset the 7-day force-start clock) was sketched at **~$23/mo** for ~100
> active hours/month. If the migration is revived before the design doc is
> refreshed, the parking discussion on #19 is the source of truth for that
> variant.

---

# Preploy — AWS Architecture Design

This document is the target architecture for migrating Preploy off Vercel +
Supabase and onto AWS. It captures the decisions made under the migration
epic [#19](https://github.com/scy02718/interview-assistant/issues/19) and is
the deliverable for design sub-issue [#20](https://github.com/scy02718/interview-assistant/issues/20).
It is the contract every downstream sub-issue (#21–#30) would build against;
if a sub-issue needed to deviate, it would amend this doc first.

## 1. Goals and non-goals

**Goals**

- Self-host Preploy on AWS under a single personal account at a target burn
  of **≤ $45/month** all-in (original always-on design; see §8 note).
- Everything reproducible from Terraform; no click-ops except one-time
  account bootstrap.
- GitHub Actions deploys via OIDC — no long-lived IAM access keys anywhere.
- Production parity with the local Docker image from PR #18: same
  `apps/web/Dockerfile`, same `/api/health` + `/api/health/live` endpoints,
  same build-time-vs-runtime env split documented in `apps/web/README.md`.
- Secrets live in AWS Secrets Manager and are injected into the ECS task via
  the task definition `secrets` block (never `environment`, never baked into
  the image).

**Non-goals (this migration)**

- Multi-AZ RDS, read replicas, connection pooling (PgBouncer / RDS Proxy).
- Autoscaling, blue/green, or canary ECS deploys.
- Separate `staging` environment. Only `prod` is provisioned.
- WAF, Shield Advanced, GuardDuty tuning, private-subnet + NAT topology.
- Bastion host / Session Manager for DB access. Schema changes run through
  Drizzle migrations from CI, not manual psql.
- Automatic secret rotation. Rotation is manual and documented.
- Moving the FastAPI side — `apps/api` was deleted previously and is not
  coming back under this migration.

## 2. Current state (what we are replacing)

| Concern        | Today                                                               |
| -------------- | ------------------------------------------------------------------- |
| Hosting        | Vercel (Next.js 16 App Router, serverless functions)                |
| Database       | Supabase Postgres (pooler URL used as `DATABASE_URL` / `SUPABASE_DB_URL`) |
| Auth           | NextAuth v5 with Google OAuth; sessions in the Postgres DB          |
| Secrets        | Vercel project env vars                                             |
| CI             | GitHub Actions running lint/typecheck/test; Vercel handles deploys  |
| Observability  | Vercel logs + Sentry (DSNs already split client/server)             |

The app does **not** use any Supabase-specific feature. Verified during doc
drafting:

- No `@supabase/*` import anywhere in `apps/web/` (grep found exactly one
  hit: a CSP `connect-src` allowlist entry in `apps/web/next.config.ts` for
  `https://*.supabase.co` — safe to drop post-cutover).
- No Row-Level Security, no `auth.users` schema, no Supabase Edge Functions,
  no Storage buckets.
- `lib/schema.ts` is vanilla Postgres: enums, `uuid().defaultRandom()`
  (maps to `gen_random_uuid()` which is core in Postgres 13+, no
  `uuid-ossp` extension needed), `jsonb`, `timestamp with time zone`,
  foreign keys. All Drizzle migrations under `apps/web/drizzle/` are plain
  `CREATE TABLE` / `ALTER TABLE` — none issue `CREATE EXTENSION`.

Bottom line: the Supabase instance is used as a dumb Postgres, so migration
to RDS is a `pg_dump | pg_restore` job, not a rewrite.

## 3. Target architecture — overview

Preploy runs as a single always-on Next.js container on ECS Fargate, behind
an internet-facing Application Load Balancer. RDS Postgres holds all state.
Route53 resolves the apex hostname to the ALB; ACM terminates TLS at the
ALB; HTTP is 301-redirected to HTTPS. The ECS task pulls its image from a
private ECR repository, reads runtime secrets from AWS Secrets Manager at
task-start, and writes logs/metrics to CloudWatch. GitHub Actions assumes a
deployment role via OIDC to push new images and force a rolling redeploy.

The VPC is intentionally minimal: one `/16`, two public subnets across two
AZs (required for the RDS subnet group even with single-AZ RDS), one
Internet Gateway, no private subnets, no NAT Gateway. Both the ECS task and
the RDS instance live in the public subnets. RDS has
`publicly_accessible = false` and a security group that only allows inbound
from the task SG. The ECS task has a public IP but its security group
allows inbound only from the ALB SG. Outbound (to OpenAI, Google OAuth,
Secrets Manager, ECR) flows through the IGW directly — no NAT.

```
                           Internet
                              |
                         [ Route53 ]
                              |  ALIAS
                              v
                     +-------------------+
                     |  ACM + ALB (443)  |   <-- :80 -> 301 -> :443
                     +---------+---------+
                               | (alb-sg -> web-sg :3000)
                ---------------+---------------
                |                               |
        +---------------+               +---------------+
        | Public subnet |               | Public subnet |
        |   AZ a /24    |               |   AZ b /24    |
        |               |               |               |
        |  ECS Fargate  |               |  (spare AZ -- |
        |  task 0.25/0.5|               |   RDS subnet  |
        |  public IP    |               |   group only) |
        |     |         |               |               |
        |     v         |               |               |
        |  RDS t4g.micro (single-AZ, primary in one of the two)
        +-------+-------+               +-------+-------+
                |   (db-sg: 5432 from web-sg only)      |
                +-----------------+---------------------+
                                  |
                                 IGW
                                  |
                         OpenAI / Google OAuth
                         Secrets Mgr / ECR / CW Logs
```

## 4. Service-by-service rationale

### 4.1 Terraform (IaC)

**What.** HCL modules under `infra/terraform/`, remote state in an S3
bucket with versioning + SSE, state locks via a DynamoDB table. One root
`prod` workspace; no `dev` workspace until staging is revived.

**Why.** Native AWS tooling, huge provider ecosystem, well-understood blast
radius. CDK was considered and rejected for a solo project: extra build
step, slower feedback loop, and TypeScript-generated CloudFormation stacks
are harder to debug when they fail. Pulumi same reasoning.

**Cost.** S3 state bucket and the lock table are effectively free at this
volume (< $0.10/mo).

### 4.2 ECS Fargate (compute)

**What.** One ECS service, `desired_count = 1`, launch type `FARGATE`, task
size `0.25 vCPU / 0.5 GB`, platform version `LATEST`. Rolling deploy with
`minimum_healthy_percent = 0` and `maximum_percent = 200` so a single task
can be replaced without capacity headroom. ECS container health check hits
`/api/health/live` (no DB touch) so a flaky DB does not kill the task; the
ALB target group health check also uses `/api/health/live`. `/api/health`
(which executes `select 1`) is available for manual readiness probing but
is not wired to any automated killer.

**Why not App Runner.** Simpler, but: no VPC connector without adding
~$5/mo egress, opaque deployment model, harder to mix with RDS SG-based
auth, no easy path to run one-off tasks (future `drizzle-kit migrate`
runner).

**Why not EKS.** Control plane alone is $73/mo. Rules itself out.

**Why not Lambda.** Next.js App Router on Lambda requires either Vercel's
adapter or SST / OpenNext — extra layer to maintain, cold starts on the
avatar route, and we already have a working container image from PR #18.

**Cost.** 0.25 vCPU × 24 × 30 × $0.04048 ≈ $7.30 + 0.5 GB × 24 × 30 ×
$0.004445 ≈ $1.60 ≈ **$9/mo** always-on.

### 4.3 RDS Postgres (state)

**What.** `db.t4g.micro`, Postgres 16, 20 GB gp3, single-AZ,
`deletion_protection = true`, 7-day automated backups, daily backup window
07:00–08:00 UTC, maintenance window Sun 08:00–09:00 UTC,
`publicly_accessible = false`, encryption at rest with the default AWS KMS
key. Master username `preploy_admin`, password generated by Terraform via
`random_password` and written to Secrets Manager.

**Why single-AZ.** Multi-AZ doubles the RDS line item for no benefit at our
RTO target (best-effort, hours). Automated backups give point-in-time
recovery within 7 days. Explicitly accepted risk, see §9.

**Why t4g.micro.** Arm/Graviton; the current Supabase workload is well
under 100 MB resident and we have not yet hit connection limits. Upgrade
path is one Terraform apply away if needed.

**Cost.** t4g.micro ≈ $12.41/mo + 20 GB gp3 ≈ $2.30/mo + backups inside the
free allowance for instances this size. Call it **$14.71/mo** always-on.

### 4.4 VPC topology (the important one)

**What.** VPC `10.42.0.0/16`. Two public subnets: `10.42.0.0/24` (AZ a) and
`10.42.1.0/24` (AZ b). One IGW. One public route table with
`0.0.0.0/0 → igw`. Both subnets associated with that route table. No
private subnets, no NAT Gateway, no VPC endpoints.

The ECS task runs with `assign_public_ip = true` in one of the two
subnets. RDS lives in a DB subnet group that spans both (AWS requires two
AZs for a DB subnet group even if the instance is single-AZ).

**Why this, not the textbook "private subnets + NAT Gateway".** A NAT
Gateway is ~$32/mo of pure overhead at our scale and would, by itself, blow
the $45 budget. Three mitigations make the public-subnet design acceptable
for this threat model:

1. **No inbound from the internet at the SG level.** `web-sg` has exactly
   one inbound rule: TCP 3000 from `alb-sg`. The task having a public IP is
   irrelevant when no SG rule accepts traffic to it from `0.0.0.0/0`. The
   public IP exists only so the task's outbound SYNs can be routed back
   through the IGW.
2. **No inbound from the internet on RDS.** `publicly_accessible = false`
   and `db-sg` allows 5432 only from `web-sg`.
3. **No long-lived shell access.** There is no bastion, no SSH, no EC2 we
   own. The only way "in" is the ALB → Next.js container, which only
   speaks the app's own HTTP surface.

The remaining real delta vs. private-subnets-with-NAT is: if an attacker
gains RCE inside the Next.js process, they can exfiltrate data over the
IGW directly. With a NAT Gateway and private subnets they would exfiltrate
over the NAT Gateway — same outcome, $32 more expensive. NAT is not an
egress-control boundary; it is a routing convenience. If we ever need real
egress control we will add a VPC endpoint for Secrets Manager/ECR and an
explicit egress allowlist, not NAT. Tracked in §10.

**Cost.** $0. The IGW is free; data transfer is accounted for separately
in §8.

### 4.5 ALB + ACM + Route53

**What.** Internet-facing Application Load Balancer in both public subnets.
Two listeners: `:80` returns a fixed 301 to `https://#{host}#{path}?#{query}`,
`:443` forwards to the ECS target group. ACM certificate for the apex and
`www` in the same region as the ALB (required; ACM certs are per-region for
ALB). Target group protocol HTTP/3000, health check path `/api/health/live`,
healthy threshold 2, unhealthy threshold 2, interval 15 s, timeout 5 s,
matcher `200`. Route53 hosted zone holds an A/ALIAS record pointing at the
ALB.

**Why ALB not NLB.** Need path-based rules eventually, need HTTP health
checks, need host header. NLB is cheaper by a hair but loses all L7
features.

**Cost.** ALB is ~$16.20/mo for the hours + a negligible LCU charge at our
traffic. Route53 hosted zone is $0.50/mo. ACM public certs are free.

### 4.6 Secrets Manager

**What.** One secret per logical credential, JSON-valued where it makes
sense (RDS gets a `{username, password, host, port, dbname}` bundle),
otherwise a single `SecretString`. The ECS task role gets
`secretsmanager:GetSecretValue` scoped to exactly these ARNs. Task
definition injects them via the `secrets` block, which ECS resolves once at
task-start and exposes as env vars to the container.

See §5 for the concrete table.

**Why not SSM Parameter Store.** `SecureString` is free and was considered.
Secrets Manager wins on: native RDS integration (we get the rotation hook
for free even though we are not using it yet), JSON secret values, and
alignment with the AWS RDS password reference the Terraform
`aws_db_instance` resource expects. $0.40/secret/mo × 5 secrets = $2 is
acceptable.

**Cost.** ~$2/mo (or $0.40/mo if consolidated to a single JSON secret).

### 4.7 CloudWatch logs + alarms

**What.** One log group, `/preploy/web`, retention **7 days**. ECS task
`awslogs` driver writes stdout/stderr (Pino JSON lines) there. Minimum
alarm set piped to one SNS topic, one email subscription:

- `ALB 5xx count > 5 in 5 min`
- `ALB Target unhealthy host count ≥ 1 for 2 periods of 1 min`
- `ECS RunningTaskCount < 1 for 2 periods of 1 min`
- `RDS CPUUtilization > 80% for 10 min`
- `RDS FreeStorageSpace < 2 GB`
- `RDS FreeableMemory < 50 MB`

**Cost.** Ingest for a 1-task service is trivially under the 5 GB free
tier. Budget ~$1/mo for headroom.

### 4.8 ECR

**What.** One private repository, `preploy/web`. Images tagged with the
commit SHA. Lifecycle policy: retain the 10 most recent SHA-tagged images
and any image tagged `prod`, expire everything else. Scan-on-push enabled.

**Cost.** ~$0.40/mo.

### 4.9 GitHub Actions OIDC

**What.** An IAM OIDC identity provider for
`token.actions.githubusercontent.com` and a `github-actions-deploy` role
with a trust policy scoped to
`repo:scy02718/interview-assistant:ref:refs/heads/main`. Permissions: ECR
push to the one repo, ECS `RegisterTaskDefinition` + `UpdateService` +
`DescribeServices` on the one service, `iam:PassRole` for the task role and
execution role, CloudWatch log tailing for deploy-time diagnostics.

**Why.** Zero long-lived keys. The trust policy pins both the repo and the
ref, so a PR branch cannot assume the role.

**Cost.** $0.

## 5. Secrets flow

Every secret below is **runtime-only** — resolved by ECS at task start and
exposed to the Next.js process as an env var. Nothing in this table belongs
in a Docker `--build-arg` or the image itself. The four build-time-baked
values (`NODE_ENV`, `HOSTNAME`, `PORT`, `NEXT_TELEMETRY_DISABLED`) are set
in `apps/web/Dockerfile` directly; `AUTH_TRUST_HOST=true` is set in the
task definition `environment` block since NextAuth v5 requires it on any
non-Vercel host (documented in `apps/web/README.md` → Local Docker).

| Env var in container  | Secret name                      | Format              | Consumer                       |
| --------------------- | -------------------------------- | ------------------- | ------------------------------ |
| `DATABASE_URL`        | `preploy/prod/db-url`            | plain string        | `apps/web/lib/db.ts` (Drizzle) |
| `SUPABASE_DB_URL`     | *(alias of above, see §9.5)*     | plain string        | Drizzle; rename post-cutover   |
| `NEXTAUTH_SECRET`     | `preploy/prod/nextauth-secret`   | plain string        | `apps/web/lib/auth.ts`         |
| `OPENAI_API_KEY`      | `preploy/prod/openai-api-key`    | plain string        | OpenAI clients in `app/api/**` |
| `GOOGLE_CLIENT_ID`    | `preploy/prod/google-oauth`      | JSON `clientId`     | NextAuth Google provider       |
| `GOOGLE_CLIENT_SECRET`| `preploy/prod/google-oauth`      | JSON `clientSecret` | NextAuth Google provider       |
| `SENTRY_DSN` *(opt.)* | `preploy/prod/sentry-dsn`        | plain string        | `sentry.server.config.ts`      |

`RDS_MASTER_PASSWORD` is stored in `preploy/prod/rds-master` and is **not**
injected into the web container — only Terraform reads it to build
`DATABASE_URL`, which is then written into `preploy/prod/db-url`.

## 6. Network topology and security groups

| Resource          | CIDR / Identifier                  |
| ----------------- | ---------------------------------- |
| VPC               | `10.42.0.0/16`                     |
| Public subnet A   | `10.42.0.0/24` (AZ a)              |
| Public subnet B   | `10.42.1.0/24` (AZ b)              |
| Internet Gateway  | one, attached                      |
| Route table       | one public, `0.0.0.0/0 → igw`      |

**Security groups** (all with egress `0.0.0.0/0` unless noted):

| SG       | Inbound rules                                         | Notes |
| -------- | ----------------------------------------------------- | ----- |
| `alb-sg` | TCP 80 from `0.0.0.0/0`; TCP 443 from `0.0.0.0/0`     | The only SG that takes internet traffic. |
| `web-sg` | TCP 3000 from `alb-sg`                                | No internet inbound; task has public IP only for egress return path. |
| `db-sg`  | TCP 5432 from `web-sg`                                | Egress restricted to none (RDS does not initiate outbound). |

Explicit non-rules:

- No `0.0.0.0/0` → `web-sg:3000`. The public IP on the task is an egress
  artifact, not an ingress path.
- No `0.0.0.0/0` → `db-sg:5432`. RDS is not publicly accessible.
- No bastion SG, no SSH anywhere.

## 7. CI/CD flow

Triggered on every push to `main` that touches `apps/web/**`,
`packages/shared/**`, `apps/web/Dockerfile`, or the workflow file itself.
All steps live in `.github/workflows/deploy.yml` **except** the AWS
resources (roles, ECR repo, ECS service, task-def template), which are
owned by Terraform in `infra/terraform/`.

1. `actions/checkout@v4`.
2. `aws-actions/configure-aws-credentials@v4` with
   `role-to-assume: arn:aws:iam::<acct>:role/github-actions-deploy` and
   `aws-region`. This is the OIDC token exchange — no stored secrets.
3. `aws-actions/amazon-ecr-login@v2` → Docker login to the private repo.
4. `docker build -f apps/web/Dockerfile -t $ECR_REPO:$GITHUB_SHA .` from
   the repo root (context must be the root, same as local — the
   Dockerfile's `deps` stage needs `package-lock.json` and
   `packages/shared`).
5. `docker push $ECR_REPO:$GITHUB_SHA`.
6. Render a new task-definition revision by fetching the current one with
   `aws ecs describe-task-definition`, patching the container image to
   `$ECR_REPO:$GITHUB_SHA` with `jq`, and calling
   `aws ecs register-task-definition`. The `secrets` and `environment`
   blocks are **not** touched by CI — they are the Terraform template's
   responsibility.
7. `aws ecs update-service --force-new-deployment --task-definition <new-arn>`.
8. `aws ecs wait services-stable` with a 10-minute timeout. On timeout the
   job fails and the previous task definition stays as the service's
   primary deployment (ECS's default rolling behaviour).

Terraform-owned, never touched by CI: IAM roles, ECR repo, the ECS cluster
+ service shell, ALB/target group, Route53 record, Secrets Manager secrets
(values managed out-of-band, not in TF state), RDS instance, CloudWatch log
group, SNS topic + alarms.

Database migrations: **out of scope for the initial deploy workflow**. For
now, `npm run db:migrate` is run locally against the RDS instance from a
developer laptop with a temporary SG rule, then the rule is reverted. A
`migrate` one-off ECS task is tracked in §10.

## 8. Monthly cost estimate

> **Note:** This section reflects the original **always-on** design. During
> the parking discussion a **scheduled wake/sleep variant** was sketched at
> ~$23/mo for ~100 active hours/month — see the parking comment on #19 for
> the full breakdown. Either variant is revivable; pick one at revival
> time.

Prices are us-east-1, post-March-2025 on-demand rates. Rounded up.

| Line item                                              | Unit                | Qty              | Monthly |
| ------------------------------------------------------ | ------------------- | ---------------- | ------: |
| ALB (hours + minimal LCU)                              | $0.0225/hr + LCU    | 730 hr           |  $16.50 |
| Fargate vCPU 0.25 × 730 h                              | $0.04048/vCPU-hr    | 182.5 vCPU-hr    |   $7.40 |
| Fargate memory 0.5 GB × 730 h                          | $0.004445/GB-hr     | 365 GB-hr        |   $1.65 |
| RDS `db.t4g.micro` single-AZ                           | $0.017/hr           | 730 hr           |  $12.41 |
| RDS gp3 storage                                        | $0.115/GB-mo        | 20 GB            |   $2.30 |
| RDS backups (inside free allowance for < 20 GB)        | —                   | —                |   $0.00 |
| Secrets Manager                                        | $0.40/secret-mo     | 5 secrets        |   $2.00 |
| ECR storage                                            | $0.10/GB-mo         | ~4 GB            |   $0.40 |
| CloudWatch logs (within free tier for our volume)      | $0.50/GB ingest     | < 1 GB           |   $0.50 |
| Route53 hosted zone                                    | $0.50/zone-mo       | 1                |   $0.50 |
| Data transfer out to internet (first 100 GB/mo free)   | $0.09/GB after      | < 100 GB est.    |   $0.00 |
| **Total (always-on)**                                  |                     |                  | **~$43.66** |

## 9. Risks and open questions

1. **Public-subnet Fargate threat model.** Covered in §4.4. Residual risk
   is post-RCE exfiltration over the IGW. Accepted. Revisit if we handle
   PII beyond what NextAuth stores (email + name).
2. **Single-AZ RDS downtime.** An AZ outage or hardware failure means
   downtime until AWS moves it — minutes to a couple of hours historically.
   Backups give point-in-time recovery within 7 days, bounding data loss
   to the RPO of automated backups (5 min). Availability risk accepted at
   best-effort RTO. Revisit when Preploy has paying users.
3. **No connection pooler.** Postgres on `t4g.micro` has
   `max_connections = 87` at default params. The Next.js container uses
   the `postgres` driver with a connection pool; one task = one pool =
   well under the limit. The moment we raise `desired_count` or introduce
   a background worker, this needs RDS Proxy or PgBouncer.
4. **Secret rotation is manual.** Secrets Manager supports rotation
   Lambdas; we are not wiring them up. Runbook: rotate RDS master via the
   AWS console → Terraform refresh → bounce the ECS service. Same pattern
   for OAuth secrets.
5. **Historical `SUPABASE_DB_URL` env name.** The code at
   `apps/web/lib/db.ts` reads `SUPABASE_DB_URL`. Post-cutover rename to
   `DATABASE_URL` in a follow-up PR. Out of scope for #20 — file as tech
   debt.
6. **ACM region pinning.** The ALB cert must live in the same region as
   the ALB. If we ever add CloudFront, we need a second cert in `us-east-1`.
7. **Health check split.** `/api/health/live` is used for both the ECS
   container health check and the ALB target group health check. This
   means a dead database does **not** flap the task — the ALB keeps
   sending traffic to a broken-DB task which returns 500s. The CloudWatch
   `ALB 5xx` alarm surfaces that condition. Accepted — keeps incident
   blast radius off the task rather than into a restart loop.
8. **Drizzle migration runner.** Day-one migrations are run from a laptop
   with a temporary SG rule. Must be fixed before the first post-cutover
   schema change.

## 10. Deferred — revisit when…

- **Multi-AZ RDS** — revisit when we have paying users or the SLA
  conversation actually matters.
- **Autoscaling ECS** — revisit when p95 response time degrades under load
  or `desired_count = 1` CPU sits > 60% sustained.
- **WAF on the ALB** — revisit on the first real abuse event or before
  exposing any unauthenticated write endpoint.
- **Bastion / Session Manager** — revisit the first time we need an
  emergency `psql` that we cannot do from a laptop with a temporary SG
  rule.
- **Staging environment** — revisit when a deploy to prod breaks something
  non-trivial and we regret not having a place to test infra changes.
- **Blue/green (CodeDeploy-managed ECS)** — revisit alongside staging.
- **PgBouncer / RDS Proxy** — revisit the moment `desired_count > 1` or we
  add a worker.
- **Observability beyond CloudWatch** — revisit when the alarm set stops
  answering "why is it slow".
- **Automatic secret rotation** — revisit after the first manual rotation
  is painful enough to justify a Lambda.
- **One-off migrate task** — revisit before the first post-cutover schema
  change. This one is "needed soon" rather than fully deferred.

## 11. Implementation order

```
  #21 Terraform bootstrap (S3 state, DynamoDB lock, OIDC provider, deploy role)
          |
          v
  #22 VPC + SGs + IGW + subnets         #25 ECR repo + lifecycle policy
          |                                         |
          v                                         |
  #23 RDS Postgres + Secrets Manager secrets        |
          |                                         |
          v                                         v
  #24 Supabase -> RDS data migration    #26 ECS cluster, task def, service
                        \                         /
                         \                       /
                          v                     v
                  #27 ALB + ACM + Route53
                                  |
                                  v
                  #28 GitHub Actions deploy workflow
                                  |
                                  v
                  #29 CloudWatch alarms
                                  |
                                  v
                  #30 Cutover + rollback runbook
```

Serial chokepoints:

- **#21 blocks everything.** State + OIDC must exist first.
- **#23 blocks #24 and #26.** RDS must exist before we can migrate data
  into it or point a task at it.
- **#27 blocks #28.** No point wiring CI until there is a target hostname
  to deploy to.
- **#30 is last.** Alarms and the DNS flip happen after we have verified
  the ECS + RDS + ALB path under real traffic.

Parallelizable:

- **#22 and #25** can start in parallel once #21 lands.
- **#24** (data migration dry-runs) can start as soon as #23 is up; the
  real cutover waits for #30.

## 12. Approval

**Status:** PARKED 2026-04-15. Design captured, not approved for
implementation. See banner at the top of this file for revival triggers.
