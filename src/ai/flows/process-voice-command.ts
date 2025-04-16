'use server';
/**
 * @fileOverview Processes voice commands to trigger corresponding robot actions.
 *
 * - processVoiceCommand - A function that processes voice commands.
 * - ProcessVoiceCommandInput - The input type for the processVoiceCommand function.
 * - ProcessVoiceCommandOutput - The return type for the processVoiceCommand function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ProcessVoiceCommandInputSchema = z.object({
  voiceCommand: z.string().describe('The voice command given by the user.'),
});
export type ProcessVoiceCommandInput = z.infer<typeof ProcessVoiceCommandInputSchema>;

const ProcessVoiceCommandOutputSchema = z.object({
  action: z.string().describe('The action to be performed by the robot.'),
  feedback: z.string().describe('The feedback to be played to the user.'),
  needsClarification: z.boolean().describe('Whether the command needs clarification before execution.'),
  clarificationType: z.enum(['direction', 'distance', 'angle', 'none']).describe('The type of clarification needed.'),
});
export type ProcessVoiceCommandOutput = z.infer<typeof ProcessVoiceCommandOutputSchema>;

export async function processVoiceCommand(input: ProcessVoiceCommandInput): Promise<ProcessVoiceCommandOutput> {
  return processVoiceCommandFlow(input);
}

const prompt = ai.definePrompt({
  name: 'processVoiceCommandPrompt',
  input: {
    schema: z.object({
      voiceCommand: z.string().describe('The voice command given by the user.'),
    }),
  },
  output: {
    schema: z.object({
      action: z.string().describe('The action to be performed by the robot.'),
      feedback: z.string().describe('The feedback to be played to the user.'),
      needsClarification: z.boolean().describe('Whether the command needs clarification before execution.'),
      clarificationType: z.enum(['direction', 'distance', 'angle', 'none']).describe('The type of clarification needed.'),
    }),
  },
  prompt: `You are a helpful assistant that processes voice commands for a robot control panel.

You will receive a voice command from the user, determine the appropriate action to perform on the robot,
and provide feedback to the user.

For directional commands:
- If the user says "turn left" or "turn right" without specifying degrees, assume 90 degrees
- If the user says just "turn" without direction or degrees, mark as needing clarification
- If the user specifies degrees (e.g., "turn left 45 degrees"), use those exact degrees

Voice Command: {{{voiceCommand}}}

Respond in a JSON format with the following fields:
- action: The action to be performed
- feedback: The feedback to be played to the user
- needsClarification: true if the command needs clarification before execution
- clarificationType: 'direction' if direction is unclear, 'angle' if angle is unclear, 'distance' if distance is unclear, 'none' if no clarification needed

Example responses:
1. For "turn left":
{
  "action": "turn left 90 degrees",
  "feedback": "Turning left 90 degrees",
  "needsClarification": false,
  "clarificationType": "none"
}

2. For "turn":
{
  "action": "turn",
  "feedback": "Which direction should I turn, left or right?",
  "needsClarification": true,
  "clarificationType": "direction"
}

3. For "turn left 45 degrees":
{
  "action": "turn left 45 degrees",
  "feedback": "Turning left 45 degrees",
  "needsClarification": false,
  "clarificationType": "none"
}
`,
});

const processVoiceCommandFlow = ai.defineFlow<
  typeof ProcessVoiceCommandInputSchema,
  typeof ProcessVoiceCommandOutputSchema
>(
  {
    name: 'processVoiceCommandFlow',
    inputSchema: ProcessVoiceCommandInputSchema,
    outputSchema: ProcessVoiceCommandOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
