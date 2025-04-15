/**
 * Represents a detected object with a label and confidence score.
 */
export interface DetectedObject {
  /**
   * The label or name of the detected object.
   */
  label: string;
  /**
   * The confidence score of the detection (0 to 1).
   */
  confidence: number;
}

/**
 * Asynchronously detects objects in an image represented as a base64 encoded string.
 *
 * @param imageBase64 The base64 encoded string of the image.
 * @returns A promise that resolves to an array of DetectedObject.
 */
export async function detectObjects(imageBase64: string): Promise<DetectedObject[]> {
  // TODO: Implement this by calling an API.

  return [
    {
      label: 'person',
      confidence: 0.95,
    },
    {
      label: 'robot',
      confidence: 0.80,
    },
  ];
}
