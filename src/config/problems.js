// Interview Problem Configurations
// Each problem includes context, starter code, and interviewer prompt data

export const PROBLEM_CONFIGS = {
  "two-sum": {
    starterCode: {
      python: `class Solution(object):
    def twoSum(self, nums, target):
        """
        :type nums: List[int]
        :type target: int
        :rtype: List[int]
        """
        # Write your solution here
        `,
      javascript: `function twoSum(nums, target) {
    // Write your solution here

}`,
      java: `public class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Write your solution here

    }
}`
    },
    problemContext: {
      title: "Two Sum",
      difficulty: "Easy",
      description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume there is exactly one solution.",
      possibleApproaches: [
        "Brute Force: O(n²) time, O(1) space - Check every pair of numbers",
        "Hash Map: O(n) time, O(n) space - Use a hash map to store complements",
        "Two Pointers: O(n log n) time, O(1) space - Sort array first, then use two pointers (but loses original indices)"
      ],
      hints: [
        "Think about what you need to find for each number - its complement",
        "Can you store previously seen numbers and their indices somewhere?",
        "What's the complement of the current number? (target - current_number)",
        "Have you seen this complement before in your iteration?"
      ],
      acceptableComplexity: {
        runtime: "O(n) - Linear time is expected for optimal solution",
        space: "O(n) - Hash map storage for seen numbers"
      },
      possibleSolutions: {
        bruteForce: `def twoSum(self, nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []`,
        optimal: `def twoSum(self, nums, target):
    num_map = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in num_map:
            return [num_map[complement], i]
        num_map[num] = i
    return []`
      },
      testCases: [
        { input: "nums = [2,7,11,15], target = 9", output: "[0,1]" },
        { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
        { input: "nums = [3,3], target = 6", output: "[0,1]" }
      ]
    }
  },

  "valid-palindrome": {
    starterCode: {
      python: `class Solution(object):
    def isPalindrome(self, s):
        """
        :type s: str
        :rtype: bool
        """
        # Write your solution here
        `,
      javascript: `function isPalindrome(s) {
    // Write your solution here

}`,
      java: `public class Solution {
    public boolean isPalindrome(String s) {
        // Write your solution here

    }
}`
    },
    problemContext: {
      title: "Valid Palindrome",
      difficulty: "Easy",
      description: "Given a string s, return true if it is a palindrome, or false otherwise. A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and digits.",
      possibleApproaches: [
        "Two-pointer technique: move pointers inward from both ends, skipping non-alphanumeric characters, and compare lowercase letters/digits",
        "String filtering + reverse check: normalize the string (lowercase, remove non-alphanumerics) and compare it to its reverse",
        "Regex-based cleaning + palindrome check"
      ],
      hints: [
        "Think about how you can ignore non-alphanumeric characters while comparing",
        "Converting the string to lowercase first may simplify comparisons",
        "You don't always need to create a new string—try using two pointers directly on the original string"
      ],
      acceptableComplexity: {
        runtime: "O(n) - Linear time where n is the length of the string",
        space: "O(1) with two-pointer method, or O(n) if building a filtered string"
      },
      possibleSolutions: {
        filtering: `def isPalindrome(self, s):
    filtered = ''.join(c.lower() for c in s if c.isalnum())
    return filtered == filtered[::-1]`,
        twoPointer: `def isPalindrome(self, s):
    left, right = 0, len(s) - 1
    while left < right:
        while left < right and not s[left].isalnum():
            left += 1
        while left < right and not s[right].isalnum():
            right -= 1
        if s[left].lower() != s[right].lower():
            return False
        left += 1
        right -= 1
    return True`
      },
      testCases: [
        { input: "s = 'A man, a plan, a canal: Panama'", output: "true" },
        { input: "s = 'race a car'", output: "false" },
        { input: "s = ' '", output: "true" }
      ]
    }
  },

  "fruit-into-baskets": {
    starterCode: {
      python: `class Solution(object):
    def totalFruit(self, fruits):
        """
        :type fruits: List[int]
        :rtype: int
        """
        # Write your solution here
        `,
      javascript: `function totalFruit(fruits) {
    // Write your solution here

}`,
      java: `public class Solution {
    public int totalFruit(int[] fruits) {
        // Write your solution here

    }
}`
    },
    problemContext: {
      title: "Fruit Into Baskets",
      difficulty: "Medium",
      description: "You are visiting a fruit farm that has a single row of fruit trees arranged from left to right. The trees are represented by an integer array fruits where fruits[i] is the type of fruit the ith tree produces. You want to collect as much fruit as possible. However, the owner has some strict rules that you must follow: You only have two baskets, and each basket can only hold a single type of fruit. Starting from any tree of your choice, you must pick exactly one fruit from every tree (including the start tree) while moving to the right. Once you reach a tree with fruit that cannot fit in your baskets, you must stop. Given the integer array fruits, return the maximum number of fruits you can pick.",
      possibleApproaches: [
        "Brute force: check every possible subarray and track fruit types (O(n²))",
        "Sliding window: maintain a window with at most 2 distinct fruit types, shrink when >2 (O(n))"
      ],
      hints: [
        "Notice that the problem is equivalent to finding the longest subarray with at most two distinct integers",
        "Try using a hash map or counter to keep track of the counts of fruits in the current window",
        "When the window contains more than two types, move the left pointer until you are back to two"
      ],
      acceptableComplexity: {
        runtime: "O(n) - Linear time where n is the number of trees",
        space: "O(1) or O(k), where k is the number of fruit types in the window (at most 2)"
      },
      possibleSolutions: {
        slidingWindow: `def totalFruit(self, fruits):
    from collections import defaultdict
    count = defaultdict(int)
    left = 0
    max_fruits = 0

    for right in range(len(fruits)):
        count[fruits[right]] += 1

        while len(count) > 2:
            count[fruits[left]] -= 1
            if count[fruits[left]] == 0:
                del count[fruits[left]]
            left += 1

        max_fruits = max(max_fruits, right - left + 1)

    return max_fruits`,
        twoPointer: `def totalFruit(self, fruits):
    if not fruits:
        return 0

    basket1, basket2 = fruits[0], None
    basket1_idx = basket2_idx = 0
    max_fruits = current_fruits = 1

    for i in range(1, len(fruits)):
        if fruits[i] == basket1 or fruits[i] == basket2:
            current_fruits += 1
        else:
            if basket2 is None:
                basket2 = fruits[i]
                basket2_idx = i
                current_fruits += 1
            else:
                # Reset from the last occurrence of the fruit we're keeping
                if basket1_idx > basket2_idx:
                    current_fruits = i - basket2_idx
                    basket2 = fruits[i]
                    basket2_idx = i
                else:
                    current_fruits = i - basket1_idx
                    basket1 = fruits[i]
                    basket1_idx = i

        if fruits[i] == basket1:
            basket1_idx = i
        elif fruits[i] == basket2:
            basket2_idx = i

        max_fruits = max(max_fruits, current_fruits)

    return max_fruits`
      },
      testCases: [
        { input: "fruits = [1,2,1]", output: "3" },
        { input: "fruits = [0,1,2,2]", output: "3" },
        { input: "fruits = [1,2,3,2,2]", output: "4" }
      ]
    }
  }
};

// Default problem for new interviews
export const DEFAULT_PROBLEM_ID = "two-sum";

// Get problem configuration by ID
export function getProblemConfig(problemId = DEFAULT_PROBLEM_ID) {
  return PROBLEM_CONFIGS[problemId] || PROBLEM_CONFIGS[DEFAULT_PROBLEM_ID];
}

// Get starter code for a specific problem and language
export function getStarterCode(problemId = DEFAULT_PROBLEM_ID, language = 'python') {
  const config = getProblemConfig(problemId);
  return config.starterCode[language] || config.starterCode.python;
}

// Get problem context for API calls
export function getProblemContext(problemId = DEFAULT_PROBLEM_ID) {
  const config = getProblemConfig(problemId);
  return config.problemContext;
}

// Get all available problem IDs
export function getAvailableProblems() {
  return Object.keys(PROBLEM_CONFIGS);
}

// Get problem display name
export function getProblemDisplayName(problemId) {
  const config = getProblemConfig(problemId);
  return `${config.problemContext.title} - ${config.problemContext.difficulty}`;
}