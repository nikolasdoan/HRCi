"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { detectObjectAndTriggerAction, DetectObjectOutput } from "@/ai/flows/detect-objects";
import { processVoiceCommand } from "@/ai/flows/process-voice-command";
import { clarifyRequirements } from "@/ai/flows/clarify-requirements";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

const ROBOT_ACTIONS = [
  "Move Forward",
  "Move Backward",
  "Turn Left",
  "Turn Right",
  "Stop",
  "Activate Shield",
  "Deactivate Shield",
];

export default function Home() {
  const [voiceCommand, setVoiceCommand] = useState("");
  const [clarifiedCommand, setClarifiedCommand] = useState("");
  const [robotAction, setRobotAction] = useState("");
  const [cameraStream, setCameraStream] = useState<string | null>(null);
  const [objectDetectionResult, setObjectDetectionResult] = useState<DetectObjectOutput | null>(null);
  const { toast } = useToast();

  // Mimic audio feedback
  const playAudioFeedback = (message: string) => {
    console.log(`Audio Feedback: ${message}`);
    toast({
      title: "Audio Feedback",
      description: message,
    });
  };

  const handleActionClick = (action: string) => {
    setRobotAction(action);
    playAudioFeedback(`Executing action: ${action}`);
  };

  const handleVoiceCommand = async () => {
    try {
      const clarification = await clarifyRequirements({ command: voiceCommand });
      setClarifiedCommand(clarification.clarifiedCommand);

      const aiResult = await processVoiceCommand({ voiceCommand: clarification.clarifiedCommand });
      setRobotAction(aiResult.action);
      playAudioFeedback(aiResult.feedback);
    } catch (error: any) {
      console.error("Error processing voice command:", error);
      playAudioFeedback(`Error: ${error.message || "Failed to process voice command"}`);
    }
  };

  const handleObjectDetection = async () => {
    if (!cameraStream) {
      playAudioFeedback("Camera stream is not available.");
      return;
    }

    try {
      const detectionResult = await detectObjectAndTriggerAction({ imageBase64: cameraStream });
      setObjectDetectionResult(detectionResult);
      detectionResult.actions.forEach((action) => playAudioFeedback(action));
    } catch (error: any) {
      console.error("Error detecting objects:", error);
      playAudioFeedback(`Error: ${error.message || "Failed to detect objects"}`);
    }
  };

  // Simulate camera access and stream (replace with actual camera logic)
  useEffect(() => {
    const simulateCameraStream = () => {
      // Replace with actual camera stream access
      const placeholderImage = "https://picsum.photos/640/480";
      fetch(placeholderImage)
        .then(response => response.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            setCameraStream(reader.result as string);
          };
          reader.readAsDataURL(blob);
        });
    };

    simulateCameraStream(); // Start the "camera" when the component mounts
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Toaster />
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-primary">RoboCommand</h1>
        <p className="text-muted-foreground">Control your robot with ease.</p>
      </header>

      <main className="flex flex-col md:flex-row gap-4 w-full max-w-4xl">
        {/* Action Dashboard */}
        <Card className="w-full md:w-1/2">
          <CardHeader>
            <CardTitle>Action Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {ROBOT_ACTIONS.map((action) => (
              <Button key={action} onClick={() => handleActionClick(action)}>
                {action}
              </Button>
            ))}
            {robotAction && <p>Last Action: {robotAction}</p>}
          </CardContent>
        </Card>

        {/* Voice Command Input */}
        <Card className="w-full md:w-1/2">
          <CardHeader>
            <CardTitle>Voice Command Input</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <textarea
              className="border rounded p-2"
              value={voiceCommand}
              onChange={(e) => setVoiceCommand(e.target.value)}
              placeholder="Enter voice command..."
            />
            <Button onClick={handleVoiceCommand}>Process Voice Command</Button>
            {clarifiedCommand && <p>Clarified Command: {clarifiedCommand}</p>}
          </CardContent>
        </Card>
      </main>

      {/* Object Detection */}
      <section className="mt-8 w-full max-w-4xl">
        <h2 className="text-2xl font-semibold text-primary mb-4">Object Detection</h2>
        {cameraStream ? (
          <div className="relative">
            <img src={cameraStream} alt="Camera Stream" className="rounded-md shadow-md" />
            <Button
              onClick={handleObjectDetection}
              className="absolute top-2 right-2 bg-accent text-primary-foreground hover:bg-accent-foreground hover:text-primary rounded-full"
            >
              Detect Objects
            </Button>
          </div>
        ) : (
          <p>Camera stream unavailable.</p>
        )}
        {objectDetectionResult && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold text-muted-foreground">Detection Results:</h3>
            <ul>
              {objectDetectionResult.detectedObjects.map((obj) => (
                <li key={obj.label}>
                  {obj.label} (Confidence: {obj.confidence})
                </li>
              ))}
            </ul>
            <h3 className="text-lg font-semibold text-muted-foreground">Triggered Actions:</h3>
            <ul>
              {objectDetectionResult.actions.map((action, index) => (
                <li key={index}>{action}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
