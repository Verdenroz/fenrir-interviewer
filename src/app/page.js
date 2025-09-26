export default function Home() {
  return (
    <div className="app">
      <h2 className="welcome">Welcome to fenrir Interviewer</h2>
      {/* contains problem and input boxes */}
      <div className="top_container">
      {/* Problem Description */}
      <div className="problem-box">
      <section>
        <h3 className="title">PROBLEM DESCRIPTION</h3>
        <p><strong>Two Sum — Easy</strong></p>
        <p className= "problem_text">
          Given an array of integers <code>nums</code> and an integer <code>target</code>, 
          return indices of the two numbers such that they add up to <code>target</code>.
          <br></br> You may assume there is exactly one solution.</p>

        <div className="example">
          <strong>Example 1:</strong>
          <p>
          Input: nums = [2,7,11,15], target = 9<br></br>
          Output: [0,1]<br></br>
          Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].<br></br>
          </p>
        </div>
        <div className="example">
        <strong>Example 2:</strong>
          <p>
          Input: nums = [3,2,4], target = 6 <br></br>
          Output: [1,2]</p>
        </div>

      </section>
      </div>

      {/* Solution Editor */}
      <div className="input-box">
      <section>
        <h3 className="title">YOUR SOLUTION</h3>
        <textarea
          className="code-input console"
          defaultValue={`class Solution(object):
    def twoSum(self, nums, target):
        """
        :type nums: List[int]
        :type target: int
        :rtype: List[int]
        """
        `}
        />
        <div>
          <button className="run">RUN CODE</button>
        </div>
        <div className="console">
          Console output will appear here.
        </div>
      </section>
      </div>
      </div>

      {/* AI Assistant */}
      <div className="ai-box">
      <section>
        <h3>AI ASSISTANT</h3>

        {/* Profile Circle */}
        <div className="profile-pic">
          <img src="/profile_pic.jpg" alt="Profile" />
        </div>

        {/* Start Meeting Button */}
        <div className="start-meeting">
          <button>Start Meeting</button>
        </div>

        {/* transcript area if we decide to add it */}
        <p>Hello! I am here to help with your work.</p>
      </section>
    </div>
    </div>
  );
}
