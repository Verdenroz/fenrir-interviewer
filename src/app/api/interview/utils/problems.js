export const PROBLEM_PROMPTS = {
  "two-sum": {
    title: "Two Sum",
    difficulty: "Easy",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    possibleApproaches: [
      "Brute Force: O(n²) - Check every pair of numbers",
      "Hash Map: O(n) - Use a hash map to store complements",
      "Two Pointers: O(n log n) - Sort array first, then use two pointers"
    ],
    hints: [
      "Think about what you need to find for each number",
      "Can you store previously seen numbers somewhere?",
      "What's the complement of the current number?"
    ],
    acceptableComplexity: {
      runtime: "O(n) - Linear time is expected for optimal solution",
      space: "O(n) - Hash map storage for seen numbers"
    },
    possibleSolutions: {
      python: {
        bruteForce: `def twoSum(self, nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]`,
        optimal: `def twoSum(self, nums, target):
    num_map = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in num_map:
            return [num_map[complement], i]
        num_map[num] = i`
      },
      javascript: {
        bruteForce: `function twoSum(nums, target) {
    for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
            if (nums[i] + nums[j] === target) {
                return [i, j];
            }
        }
    }
}`,
        optimal: `function twoSum(nums, target) {
    const numMap = new Map();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (numMap.has(complement)) {
            return [numMap.get(complement), i];
        }
        numMap.set(nums[i], i);
    }
}`
      },
      java: {
        bruteForce: `public int[] twoSum(int[] nums, int target) {
    for (int i = 0; i < nums.length; i++) {
        for (int j = i + 1; j < nums.length; j++) {
            if (nums[i] + nums[j] == target) {
                return new int[]{i, j};
            }
        }
    }
    return new int[]{};
}`,
        optimal: `public int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> numMap = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
        int complement = target - nums[i];
        if (numMap.containsKey(complement)) {
            return new int[]{numMap.get(complement), i};
        }
        numMap.put(nums[i], i);
    }
    return new int[]{};
}`
      }
    }
  },

  "reverse-linked-list": {
    title: "Reverse Linked List",
    difficulty: "Easy",
    description: "Given the head of a singly linked list, reverse the list, and return the reversed list.",
    possibleApproaches: [
      "Iterative: O(n) time, O(1) space - Use three pointers to reverse links",
      "Recursive: O(n) time, O(n) space - Recursively reverse the rest of the list"
    ],
    hints: [
      "Think about what it means to reverse the direction of pointers",
      "You'll need to keep track of the previous node",
      "Be careful not to lose the reference to the next node"
    ],
    acceptableComplexity: {
      runtime: "O(n) - Must visit each node once",
      space: "O(1) for iterative, O(n) for recursive due to call stack"
    },
    possibleSolutions: {
      python: {
        iterative: `def reverseList(self, head):
    prev = None
    current = head
    while current:
        next_temp = current.next
        current.next = prev
        prev = current
        current = next_temp
    return prev`,
        recursive: `def reverseList(self, head):
    if not head or not head.next:
        return head
    reversed_head = self.reverseList(head.next)
    head.next.next = head
    head.next = None
    return reversed_head`
      },
      javascript: {
        iterative: `function reverseList(head) {
    let prev = null;
    let current = head;
    while (current) {
        const nextTemp = current.next;
        current.next = prev;
        prev = current;
        current = nextTemp;
    }
    return prev;
}`,
        recursive: `function reverseList(head) {
    if (!head || !head.next) {
        return head;
    }
    const reversedHead = reverseList(head.next);
    head.next.next = head;
    head.next = null;
    return reversedHead;
}`
      }
    }
  }
};

export const DEFAULT_PROBLEM = "two-sum";

export function getProblemContext(problemId = DEFAULT_PROBLEM) {
  return PROBLEM_PROMPTS[problemId] || PROBLEM_PROMPTS[DEFAULT_PROBLEM];
}