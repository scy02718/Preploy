"use client";

import { useState, useCallback } from "react";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { ProblemDescription, Problem } from "@/components/editor/ProblemDescription";

const TWO_SUM_PROBLEM: Problem = {
  title: "1. Two Sum",
  difficulty: "Easy",
  description:
    "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.",
  examples: [
    {
      input: "nums = [2,7,11,15], target = 9",
      output: "[0,1]",
      explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
    },
    {
      input: "nums = [3,2,4], target = 6",
      output: "[1,2]",
    },
    {
      input: "nums = [3,3], target = 6",
      output: "[0,1]",
    },
  ],
  constraints: [
    "2 <= nums.length <= 10^4",
    "-10^9 <= nums[i] <= 10^9",
    "-10^9 <= target <= 10^9",
    "Only one valid answer exists.",
  ],
};

const STARTER_CODE: Record<string, string> = {
  python: `def two_sum(nums, target):
    # Write your solution here
    pass
`,
  javascript: `function twoSum(nums, target) {
    // Write your solution here
}
`,
  java: `import java.util.*;

public class Main {
    public static int[] twoSum(int[] nums, int target) {
        // Write your solution here
        return new int[]{};
    }
}
`,
  cpp: `#include <vector>
#include <unordered_map>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    // Write your solution here
    return {};
}
`,
  go: `package main

func twoSum(nums []int, target int) []int {
    // Write your solution here
    return nil
}
`,
};

export default function TechnicalSpikePage() {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(STARTER_CODE["python"]);

  const handleLanguageChange = useCallback((newLang: string) => {
    setLanguage(newLang);
    setCode(STARTER_CODE[newLang] ?? "");
  }, []);

  const handleReset = useCallback(() => {
    setCode(STARTER_CODE[language] ?? "");
  }, [language]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="border-b px-6 py-3">
        <h1 className="text-lg font-bold">Code Editor Spike</h1>
        <p className="text-sm text-muted-foreground">
          Test Monaco editor — write code and explain your approach verbally
          (no code execution)
        </p>
      </div>

      {/* Main layout — problem left, editor right */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — problem description */}
        <div className="w-[40%] overflow-auto border-r">
          <ProblemDescription problem={TWO_SUM_PROBLEM} />
        </div>

        {/* Right panel — editor */}
        <div className="flex w-[60%] flex-col">
          <EditorToolbar
            language={language}
            onLanguageChange={handleLanguageChange}
            onReset={handleReset}
          />

          <div className="flex-1 overflow-hidden">
            <CodeEditor
              language={language}
              value={code}
              onChange={setCode}
            />
          </div>

          {/* Info bar */}
          <div className="border-t bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Explain your thought process out loud as you code. Your speech and
            code will be analyzed together by AI after the session.
          </div>
        </div>
      </div>
    </div>
  );
}
