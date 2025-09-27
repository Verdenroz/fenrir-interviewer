// Interview Problem Configurations
// Each problem includes context, starter code, and interviewer prompt data

// Types for problem configuration
export interface TestCase {
  input: string;
  output: string;
  explanation?: string;
}

export interface ProblemContext {
  title: string;
  difficulty: string;
  description: string;
  possibleApproaches: string[];
  hints: string[];
  acceptableComplexity: {
    runtime: string;
    space: string;
  };
  possibleSolutions: Record<string, string>;
  testCases: TestCase[];
}

export interface StarterCode {
  python: string;
  javascript: string;
  java: string;
}

export interface ProblemConfig {
  starterCode: StarterCode;
  problemContext: ProblemContext;
}

export type ProblemId = keyof typeof PROBLEM_CONFIGS;

export type Language = keyof StarterCode;

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
  },

  "course-schedule-ii": {
    starterCode: {
      python: `class Solution(object):
    def findOrder(self, numCourses, prerequisites):
        """
        :type numCourses: int
        :type prerequisites: List[List[int]]
        :rtype: List[int]
        """
        # Write your solution here
        `,
      javascript: `function findOrder(numCourses, prerequisites) {
    // Write your solution here

}`,
      java: `public class Solution {
    public int[] findOrder(int numCourses, int[][] prerequisites) {
        // Write your solution here

    }
}`
    },
    problemContext: {
      title: "Course Schedule II",
      difficulty: "Medium",
      description: "There are a total of numCourses courses you have to take, labeled from 0 to numCourses - 1. You are given an array prerequisites where prerequisites[i] = [ai, bi] indicates that you must take course bi first if you want to take course ai. Return the ordering of courses you should take to finish all courses. If there are many valid answers, return any of them. If it is impossible to finish all courses, return an empty array.",
      possibleApproaches: [
        "Topological Sort with DFS: Use depth-first search with cycle detection and post-order traversal",
        "Topological Sort with BFS (Kahn's Algorithm): Remove nodes with in-degree 0 iteratively",
        "Build adjacency graph first, then apply topological ordering algorithm"
      ],
      hints: [
        "This is a topological sort problem - you need to find a valid ordering of courses",
        "Think about how to detect cycles in the prerequisite graph",
        "Consider tracking the in-degree (number of prerequisites) for each course",
        "If there's a cycle, it's impossible to complete all courses",
        "You can use either DFS with recursion stack or BFS with queue approach"
      ],
      acceptableComplexity: {
        runtime: "O(V + E) - Linear time where V is numCourses and E is prerequisites length",
        space: "O(V + E) - Space for adjacency list and auxiliary data structures"
      },
      possibleSolutions: {
        dfs: `def findOrder(self, numCourses, prerequisites):
    # Build adjacency list
    graph = [[] for _ in range(numCourses)]
    for course, prereq in prerequisites:
        graph[prereq].append(course)

    # 0: unvisited, 1: visiting, 2: visited
    state = [0] * numCourses
    result = []

    def dfs(course):
        if state[course] == 1:  # cycle detected
            return False
        if state[course] == 2:  # already processed
            return True

        state[course] = 1  # mark as visiting
        for next_course in graph[course]:
            if not dfs(next_course):
                return False

        state[course] = 2  # mark as visited
        result.append(course)
        return True

    for course in range(numCourses):
        if state[course] == 0:
            if not dfs(course):
                return []

    return result[::-1]`,
        bfs: `def findOrder(self, numCourses, prerequisites):
    from collections import deque, defaultdict

    # Build graph and in-degree array
    graph = defaultdict(list)
    in_degree = [0] * numCourses

    for course, prereq in prerequisites:
        graph[prereq].append(course)
        in_degree[course] += 1

    # Start with courses having no prerequisites
    queue = deque([i for i in range(numCourses) if in_degree[i] == 0])
    result = []

    while queue:
        course = queue.popleft()
        result.append(course)

        # Remove this course and decrease in-degree of dependent courses
        for next_course in graph[course]:
            in_degree[next_course] -= 1
            if in_degree[next_course] == 0:
                queue.append(next_course)

    # Check if all courses can be taken (no cycles)
    return result if len(result) == numCourses else []`
      },
      testCases: [
        { input: "numCourses = 2, prerequisites = [[1,0]]", output: "[0,1]" },
        { input: "numCourses = 4, prerequisites = [[1,0],[2,0],[3,1],[3,2]]", output: "[0,2,1,3] or [0,1,2,3]" },
        { input: "numCourses = 1, prerequisites = []", output: "[0]" },
        { input: "numCourses = 3, prerequisites = [[1,0],[1,2],[0,1]]", output: "[] (cycle exists)" }
      ]
    }
  }
};

// Default problem for new interviews
export const DEFAULT_PROBLEM_ID = "two-sum";

// Get problem configuration by ID
export function getProblemConfig(problemId: string = DEFAULT_PROBLEM_ID): ProblemConfig {
  return PROBLEM_CONFIGS[problemId as ProblemId] || PROBLEM_CONFIGS[DEFAULT_PROBLEM_ID];
}

// Get starter code for a specific problem and language
export function getStarterCode(problemId: string = DEFAULT_PROBLEM_ID, language: Language = 'python'): string {
  const config = getProblemConfig(problemId);
  return config.starterCode[language] || config.starterCode.python;
}

// Get problem context for API calls
export function getProblemContext(problemId: string = DEFAULT_PROBLEM_ID): ProblemContext {
  const config = getProblemConfig(problemId);
  return config.problemContext;
}

// Get all available problem IDs
export function getAvailableProblems(): string[] {
  return Object.keys(PROBLEM_CONFIGS);
}

// Get problem display name
export function getProblemDisplayName(problemId: string): string {
  const config = getProblemConfig(problemId);
  return `${config.problemContext.title} - ${config.problemContext.difficulty}`;
}