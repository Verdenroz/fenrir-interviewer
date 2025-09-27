import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

// Helper function to create WAV header for PCM data
function createWavHeader(dataLength, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true); // ChunkSize
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (PCM)
  view.setUint16(22, channels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * channels * bitsPerSample / 8, true); // ByteRate
  view.setUint16(32, channels * bitsPerSample / 8, true); // BlockAlign
  view.setUint16(34, bitsPerSample, true); // BitsPerSample

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataLength, true); // Subchunk2Size

  return new Uint8Array(buffer);
}

export async function POST(request) {
  try {
    const { userInput, conversationHistory, problemContext, currentCode, language = 'python' } = await request.json();

    if (!userInput) {
      return NextResponse.json(
        { error: 'Missing userInput' },
        { status: 400 }
      );
    }

    const client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    const generateConversationPrompt = (input, history, problemContext, currentCode, language) => {
      const context = problemContext;

      const basePrompt = `You are an AI technical interviewer conducting a coding interview. You are helping the candidate solve the "${context.title}" problem.

PROBLEM CONTEXT:
- Title: ${context.title} (${context.difficulty})
- Description: ${context.description}

POSSIBLE APPROACHES:
${(context.possibleApproaches || context.approaches || []).map(approach => `- ${approach}`).join('\n')}

HINTS TO GUIDE CANDIDATE:
${(context.hints || []).map(hint => `- ${hint}`).join('\n')}

ACCEPTABLE COMPLEXITY:
- Runtime: ${context.acceptableComplexity?.runtime || 'Not specified'}
- Space: ${context.acceptableComplexity?.space || 'Not specified'}

POSSIBLE SOLUTIONS:
Available for reference but don't give away immediately

CURRENT CODE FROM CANDIDATE:
\`\`\`${language}
${currentCode || 'No code written yet'}
\`\`\`

YOUR ROLE AS INTERVIEWER:
- Guide the candidate through the problem-solving process
- Ask probing questions about their approach and thinking
- Provide hints when they're stuck (don't give away the solution immediately)
- Comment on their current code if they've written any
- Encourage good practices like thinking about edge cases and time complexity
- Be supportive but maintain the professional interview atmosphere
- If they seem completely stuck, offer gentle guidance toward a working approach

CONVERSATION HISTORY:
${history.map(h => `${h.role}: ${h.content}`).join('\n')}

CANDIDATE: "${input}"

Respond as a technical interviewer. Keep responses under 80 words and sound natural when spoken. Focus on guiding their problem-solving process based on their current progress and the code they've written.`;

      return basePrompt;
    };

    const prompt = generateConversationPrompt(userInput, conversationHistory || [], problemContext, currentCode, language);

    // Generate text response using regular Gemini model
    const textResponse = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 200
        }
      }
    });

    const responseText = textResponse.text || 'I understand. Let me ask you another question.';
    console.log('Generated text response:', responseText);

    // Convert text to speech using TTS model
    let audioBase64 = null;
    try {
      const ttsResponse = await client.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: responseText }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Fenrir' }, // Best boi
            },
          },
        },
      });

      // Extract audio data from TTS response
      const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        // Convert base64 to buffer to check if it needs WAV header
        const pcmBuffer = Buffer.from(audioData, 'base64');
        console.log('Generated audio response, PCM length:', pcmBuffer.length);

        // Check if it's already a WAV file (starts with 'RIFF')
        const isWav = pcmBuffer.subarray(0, 4).toString() === 'RIFF';

        if (isWav) {
          // Already a proper WAV file
          audioBase64 = audioData;
        } else {
          // Raw PCM data, need to add WAV header
          const wavHeader = createWavHeader(pcmBuffer.length);
          const wavBuffer = new Uint8Array(wavHeader.length + pcmBuffer.length);
          wavBuffer.set(wavHeader, 0);
          wavBuffer.set(pcmBuffer, wavHeader.length);

          audioBase64 = Buffer.from(wavBuffer).toString('base64');
        }

        console.log('Final audio response, length:', audioBase64.length);
      }
    } catch (ttsError) {
      console.warn('TTS generation failed, returning text-only:', ttsError.message);
      // Continue without audio if TTS fails
    }

    return NextResponse.json({
      text: responseText,
      audio: audioBase64,
      success: true
    });

  } catch (error) {
    console.error('Error generating interview response:', error);
    return NextResponse.json(
      { error: 'Failed to generate response: ' + error.message },
      { status: 500 }
    );
  }
}