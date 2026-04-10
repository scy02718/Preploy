import { z } from "zod/v4";

export const behavioralConfigSchema = z.object({
  company_name: z.string().max(200).optional(),
  job_description: z.string().max(5000).optional(),
  expected_questions: z
    .array(z.string().max(500))
    .max(10)
    .optional(),
  interview_style: z.number().min(0).max(1),
  difficulty: z.number().min(0).max(1),
});

export const technicalConfigSchema = z.object({
  interview_type: z.enum(["leetcode", "system_design", "frontend", "backend"]),
  focus_areas: z.array(z.string()).min(1),
  language: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export const createSessionSchema = z.object({
  type: z.enum(["behavioral", "technical"]),
  config: z.record(z.string(), z.unknown()).optional(),
});
