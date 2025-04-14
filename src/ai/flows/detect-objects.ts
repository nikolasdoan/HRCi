// src/ai/flows/detect-objects.ts
'use server';
/**
 * @fileOverview Detects objects from an image and triggers related actions.
 *
 * - detectObjectAndTriggerAction - A function that handles the object detection process.
 * - DetectObjectInput - The input type for the detectObjectAndTriggerAction function.
 * - DetectObjectOutput - The return type for the detectObjectAndTriggerAction function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {detectObjects, DetectedObject} from '@/services/object-detection';

const DetectObjectInputSchema = z.object({
  imageBase64: z.string().describe('The base64 encoded string of the image.'),
});
export type DetectObjectInput = z.infer<typeof DetectObjectInputSchema>;

const DetectObjectOutputSchema = z.object({
  detectedObjects: z.array(z.object({
    label: z.string().describe('The label of the detected object.'),
    confidence: z.number().describe('The confidence score of the detection (0 to 1).'),
  })).describe('The list of detected objects in the image.'),
  actions: z.array(z.string()).describe('The list of actions triggered based on the detected objects.'),
});
export type DetectObjectOutput = z.infer<typeof DetectObjectOutputSchema>;

export async function detectObjectAndTriggerAction(input: DetectObjectInput): Promise<DetectObjectOutput> {
  return detectObjectAndTriggerActionFlow(input);
}

const detectObjectAndTriggerActionFlow = ai.defineFlow<
  typeof DetectObjectInputSchema,
  typeof DetectObjectOutputSchema
>({
  name: 'detectObjectAndTriggerActionFlow',
  inputSchema: DetectObjectInputSchema,
  outputSchema: DetectObjectOutputSchema,
},
async input => {
  const detectedObjects: DetectedObject[] = await detectObjects(input.imageBase64);

  // Dummy logic to trigger actions based on detected objects
  const actions: string[] = [];
  detectedObjects.forEach(object => {
    if (object.label === 'person') {
      actions.push('Initiate security protocol');
    }
    if (object.label === 'robot') {
      actions.push('Start robot interaction sequence');
    }
  });

  return {
    detectedObjects,
    actions,
  };
});
