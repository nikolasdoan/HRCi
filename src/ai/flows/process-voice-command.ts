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
    }),
  },
  prompt: `You are a helpful assistant that processes voice commands for a robot control panel.

You will receive a voice command from the user, determine the appropriate action to perform on the robot,
and provide feedback to the user.

Voice Command: {{{voiceCommand}}}

Respond in a JSON format.
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
