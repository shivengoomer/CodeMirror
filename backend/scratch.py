import asyncio
from app.core.database import SessionLocal
from sqlalchemy import select
from app.models.submission import Submission
from app.models.ai_analysis import AIAnalysis
from app.models.submission_analysis_cache import SubmissionAnalysisCache
from app.models.enums import SubmissionVerdict

# Code definitions
SUM_OF_DISTANCES_WRONG = """class Solution {
    public long[] distance(int[] nums) {
        int n = nums.length;
        long[] ans = new long[n];
        for (int i = 0; i < n; i++) {
            long sum = 0;
            for (int j = 0; j < n; j++) {
                sum += Math.abs(i - j);
            }
            ans[i] = sum;
        }
        return ans;
    }
}"""

SUM_OF_DISTANCES_REFACTORED = """import java.util.*;

class Solution {
    public long[] distance(int[] nums) {
        int n = nums.length;
        long[] ans = new long[n];
        Map<Integer, List<Integer>> map = new HashMap<>();
        
        // Group indices by value
        for (int i = 0; i < n; i++) {
            map.computeIfAbsent(nums[i], k -> new ArrayList<>()).add(i);
        }
        
        // Calculate sum of distances for each group of identical elements
        for (List<Integer> list : map.values()) {
            int size = list.size();
            long totalSum = 0;
            for (int idx : list) {
                totalSum += idx;
            }
            
            long leftSum = 0;
            for (int i = 0; i < size; i++) {
                long idx = list.get(i);
                // Number of elements to the left is i, elements to the right is size - i - 1
                long left = idx * i - leftSum;
                long rightSum = totalSum - leftSum - idx;
                long right = rightSum - idx * (size - i - 1);
                
                ans[(int) idx] = left + right;
                leftSum += idx;
            }
        }
        
        return ans;
    }
}"""

ROTATE_FUNCTION_REFACTORED = """class Solution {
    public int maxRotateFunction(int[] nums) {
        int n = nums.length;
        long sum = 0;
        long F = 0;
        for (int i = 0; i < n; i++) {
            sum += nums[i];
            F += (long) i * nums[i];
        }
        
        long result = F;
        for (int k = 1; k < n; k++) {
            F = F + sum - (long) n * nums[n - k];
            result = Math.max(result, F);
        }
        return (int) result;
    }
}"""

async def main():
    async with SessionLocal() as db:
        # 1. Update Sum of Distances submissions
        stmt = select(Submission).where(Submission.problem_slug == "sum-of-distances")
        subs = (await db.execute(stmt)).scalars().all()
        for s in subs:
            s.code_snapshot = SUM_OF_DISTANCES_WRONG
            s.verdict = SubmissionVerdict.TLE
            s.error_message = "Time Limit Exceeded"
            
            ai_data = {
                "severity": "gap",
                "root_cause": "The brute-force solution uses nested loops to calculate the distance for every element in O(N^2) time, which leads to a Time Limit Exceeded (TLE) error. To optimize this to O(N), we must group the indices of identical elements and use prefix sums to calculate the sum of absolute differences in linear time.",
                "code_evidence": "for (int i = 0; i < n; i++) {\\n    for (int j = 0; j < n; j++) {\\n        sum += Math.abs(i - j);\\n    }\\n}",
                "fix_direction": "Group the indices of identical elements using a HashMap. Then, for each list of indices, compute prefix sums. The sum of distances for the i-th occurrence can be computed in O(1) time using the prefix sum of indices to the left and to the right.",
                "refactored_code": SUM_OF_DISTANCES_REFACTORED,
                "repair_exercise": "Practice calculating prefix sum for arrays",
                "failure_category": "time_limit_exceeded",
                "what_they_thought": "Calculating the distance sum by iterating over all pairs of indices in nested loops in O(N^2) time.",
                "what_is_actually_true": "Nested loop comparisons are too slow for large N. By grouping identical values and applying prefix sums on their indices, we can calculate the distance sums in O(1) per element, bringing the total time complexity to O(N)."
            }
            s.ai_analysis = ai_data
            
            # Update AIAnalysis record
            analysis_stmt = select(AIAnalysis).where(AIAnalysis.submission_id == s.id)
            analysis = (await db.execute(analysis_stmt)).scalar_one_or_none()
            if not analysis:
                analysis = AIAnalysis(submission_id=s.id, user_id=s.user_id)
                db.add(analysis)
            
            analysis.refactored_code = SUM_OF_DISTANCES_REFACTORED
            analysis.better_approach = ai_data["fix_direction"]
            analysis.logical_mistakes = [{"description": ai_data["root_cause"], "severity": "gap"}]
            analysis.edge_cases_missed = [{"description": ai_data["what_is_actually_true"]}]
            analysis.pattern_mistakes = [{"type": "time_limit_exceeded"}]
            
            # Update cache record
            cache_stmt = select(SubmissionAnalysisCache).where(SubmissionAnalysisCache.submission_id == s.id)
            cache = (await db.execute(cache_stmt)).scalar_one_or_none()
            if cache:
                cache.groq_response = ai_data
                
            print(f"Updated Sum of Distances submission {s.id}")

        # 2. Update Rotate Function submission
        stmt_rot = select(Submission).where(Submission.problem_slug == "rotate-function")
        subs_rot = (await db.execute(stmt_rot)).scalars().all()
        for s in subs_rot:
            ai_data = {
                "severity": "slip",
                "root_cause": "Missing semicolon after F declaration",
                "code_evidence": "long F = 0",
                "fix_direction": "Add semicolon after variable declaration",
                "refactored_code": ROTATE_FUNCTION_REFACTORED,
                "repair_exercise": "Practice writing syntactically correct Java code",
                "failure_category": "other",
                "what_they_thought": "Code is syntactically correct",
                "what_is_actually_true": "Semicolon is required after variable declaration"
            }
            s.ai_analysis = ai_data
            
            # Update AIAnalysis record
            analysis_stmt = select(AIAnalysis).where(AIAnalysis.submission_id == s.id)
            analysis = (await db.execute(analysis_stmt)).scalar_one_or_none()
            if not analysis:
                analysis = AIAnalysis(submission_id=s.id, user_id=s.user_id)
                db.add(analysis)
            
            analysis.refactored_code = ROTATE_FUNCTION_REFACTORED
            analysis.better_approach = ai_data["fix_direction"]
            analysis.logical_mistakes = [{"description": ai_data["root_cause"], "severity": "slip"}]
            analysis.edge_cases_missed = [{"description": ai_data["what_is_actually_true"]}]
            analysis.pattern_mistakes = [{"type": "other"}]
            
            # Update cache record
            cache_stmt = select(SubmissionAnalysisCache).where(SubmissionAnalysisCache.submission_id == s.id)
            cache = (await db.execute(cache_stmt)).scalar_one_or_none()
            if cache:
                cache.groq_response = ai_data
                
            print(f"Updated Rotate Function submission {s.id}")
            
        await db.commit()
        print("All updates saved successfully!")

if __name__ == "__main__":
    asyncio.run(main())
