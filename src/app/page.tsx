"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { detectObjectAndTriggerAction, DetectObjectOutput } from "@/ai/flows/detect-objects";
import { processVoiceCommand } from "@/ai/flows/process-voice-command";
import { clarifyRequirements } from "@/ai/flows/clarify-requirements";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

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
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({video: true});
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use this app.',
        });
      }
    };

    getCameraPermission();
  }, [toast]);


  useEffect(() => {
    let SpeechRecognition: any = null;
    let speechSynthesis: any = null;

    const loadSpeechAPI = async () => {
      if (typeof window !== "undefined") {
        SpeechRecognition =
          window.SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (SpeechRecognition) {
          recognitionRef.current = new SpeechRecognition();
          recognitionRef.current.continuous = false;
          recognitionRef.current.lang = "en-US";

          recognitionRef.current.onstart = () => {
            setIsListening(true);
            playAudioFeedback("Listening...");
          };

          recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
            const transcript = Array.from(event.results)
              .map((result) => result[0])
              .map((result) => result.transcript)
              .join("");
            setVoiceCommand(transcript);
          };

          recognitionRef.current.onend = () => {
            setIsListening(false);
          };

          recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error("Speech recognition error:", event.error);
            setIsListening(false);
            playAudioFeedback(`Error: ${event.error}`);
            toast({
              variant: "destructive",
              title: "Speech Recognition Error",
              description: `There was an error in processing your command. ${event.error}`,
            });
          };
        } else {
          toast({
            variant: "destructive",
            title: "Speech Recognition Not Supported",
            description: "Your browser does not support speech recognition.",
          });
        }

        speechSynthesis = window.speechSynthesis;

        synthRef.current = speechSynthesis;
      }
    };

    loadSpeechAPI();
  }, [toast]);

  const startListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  // Mimic audio feedback using speech synthesis
  const playAudioFeedback = (message: string) => {
    if (synthRef.current && message) {
      const utterance = new SpeechSynthesisUtterance(message);
      synthRef.current.speak(utterance);
    }
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
      toast({
        variant: "destructive",
        title: "Voice Command Error",
        description: error.message || "Failed to process voice command",
      });
    }
  };

  const handleObjectDetection = async () => {
    if (!videoRef.current) {
      playAudioFeedback("Camera stream is not available.");
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: "Camera stream is not available.",
      });
      return;
    }

    // Capture a frame from the video stream as a base64 encoded image
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const imageBase64 = canvas.toDataURL('image/jpeg');

    try {
      const detectionResult = await detectObjectAndTriggerAction({ imageBase64: imageBase64 });
      setObjectDetectionResult(detectionResult);
      detectionResult.actions.forEach((action) => {
        playAudioFeedback(`Object Detected Action: ${action}`);
        setRobotAction(action); // Set the robot action based on detected object
      });
    } catch (error: any) {
      console.error("Error detecting objects:", error);
      playAudioFeedback(`Error: ${error.message || "Failed to detect objects"}`);
      toast({
        variant: "destructive",
        title: "Object Detection Error",
        description: error.message || "Failed to detect objects",
      });
    }
  };

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
            <div className="flex items-center">
              <Textarea
                className="border rounded p-2 w-full"
                value={voiceCommand}
                onChange={(e) => setVoiceCommand(e.target.value)}
                placeholder="Enter voice command or speak..."
                rows={3}
              />
              <Button
                onClick={isListening ? stopListening : startListening}
                disabled={!recognitionRef.current}
              >
                {isListening ? "Stop Listening" : "Start Listening"}
              </Button>
            </div>
            <Button onClick={handleVoiceCommand} disabled={!voiceCommand}>
              Process Voice Command
            </Button>
            {clarifiedCommand && <p>Clarified Command: {clarifiedCommand}</p>}
          </CardContent>
        </Card>
      </main>

      {/* Object Detection */}
      <section className="mt-8 w-full max-w-4xl">
        <h2 className="text-2xl font-semibold text-primary mb-4">Object Detection</h2>
        <div className="relative">
          <video ref={videoRef} className="w-full aspect-video rounded-md" autoPlay muted />
            { !(hasCameraPermission) && (
                <Alert variant="destructive">
                  <AlertTitle>Camera Access Required</AlertTitle>
                  <AlertDescription>
                    Please allow camera access to use this feature.
                  </AlertDescription>
                </Alert>
              )
            }
            <Button
              onClick={handleObjectDetection}
              className="absolute top-2 right-2 bg-accent text-primary-foreground hover:bg-accent-foreground hover:text-primary rounded-full"
            >
              Detect Objects
            </Button>
        </div>
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
