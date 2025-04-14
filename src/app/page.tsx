"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { processVoiceCommand } from "@/ai/flows/process-voice-command";
import { clarifyRequirements } from "@/ai/flows/clarify-requirements";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

// Import MediaPipe dependencies
import { FilesetResolver, ObjectDetector, ObjectDetectorResult } from "@google-mediapipe/tasks-vision";

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
  const [objectDetectionResult, setObjectDetectionResult] = useState<ObjectDetectorResult | null>(null);
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
	const [objectDetector, setObjectDetector] = useState<ObjectDetector | null>(null);


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
            // Mimic audio feedback using speech synthesis
            if (synthRef.current) {
              const utterance = new SpeechSynthesisUtterance("Listening...");
              synthRef.current.speak(utterance);
            }
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

  const handleActionClick = (action: string) => {
    setRobotAction(action);
    // Mimic audio feedback using speech synthesis
    if (synthRef.current) {
      const utterance = new SpeechSynthesisUtterance(`Executing action: ${action}`);
      synthRef.current.speak(utterance);
    }
  };

  const handleVoiceCommand = async () => {
    try {
      const clarification = await clarifyRequirements({ command: voiceCommand });
      setClarifiedCommand(clarification.clarifiedCommand);

      const aiResult = await processVoiceCommand({ voiceCommand: clarification.clarifiedCommand });
      setRobotAction(aiResult.action);

      // Mimic audio feedback using speech synthesis
      if (synthRef.current) {
        const utterance = new SpeechSynthesisUtterance(aiResult.feedback);
        synthRef.current.speak(utterance);
      }
    } catch (error: any) {
      console.error("Error processing voice command:", error);
      toast({
        variant: "destructive",
        title: "Voice Command Error",
        description: error.message || "Failed to process voice command",
      });
    }
  };

    useEffect(() => {
        const initializeMediaPipe = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
                );
                const detector = await ObjectDetector.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite`,
                        delegate: "GPU"
                    },
                    maxResults: 5,
                    scoreThreshold: 0.5
                });
                setObjectDetector(detector);
            } catch (error: any) {
                console.error("Error initializing MediaPipe:", error);
                toast({
                    variant: "destructive",
                    title: "MediaPipe Initialization Error",
                    description: error.message || "Failed to initialize MediaPipe."
                });
            }
        };

        initializeMediaPipe();
    }, [toast]);


    const handleObjectDetection = async () => {
        if (!videoRef.current || !objectDetector) {
            toast({
                variant: "destructive",
                title: "Object Detection Error",
                description: "Camera stream or object detector not available."
            });
            return;
        }

        try {
            const video = videoRef.current;
            const results = objectDetector.detectForVideo(video, Date.now());
            setObjectDetectionResult(results);

            // Trigger actions based on detected objects
            if (results.detections && results.detections.length > 0) {
                results.detections.forEach(detection => {
                    const label = detection.categories[0].categoryName;
                    if (label === 'person') {
                        setRobotAction('Initiate security protocol');
                        // Mimic audio feedback using speech synthesis
                        if (synthRef.current) {
                            const utterance = new SpeechSynthesisUtterance("Initiating security protocol due to person detection.");
                            synthRef.current.speak(utterance);
                        }
                    } else if (label === 'cell phone') {
                        setRobotAction('Start robot interaction sequence');
                        // Mimic audio feedback using speech synthesis
                        if (synthRef.current) {
                            const utterance = new SpeechSynthesisUtterance("Starting robot interaction sequence due to cell phone detection.");
                            synthRef.current.speak(utterance);
                        }
                    } else {
                      setRobotAction('Object Detected');
                      if (synthRef.current) {
                        const utterance = new SpeechSynthesisUtterance("Object Detected.");
                        synthRef.current.speak(utterance);
                    }
                    }
                });
            }
        } catch (error: any) {
            console.error("Object detection error:", error);
            toast({
                variant: "destructive",
                title: "Object Detection Error",
                description: error.message || "Failed to detect objects."
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
              disabled={!objectDetector}
            >
              Detect Objects
            </Button>
        </div>
        {objectDetectionResult && objectDetectionResult.detections && (
            <div className="mt-4">
                <h3 className="text-lg font-semibold text-muted-foreground">Detection Results:</h3>
                <ul>
                    {objectDetectionResult.detections.map((detection, index) => (
                        <li key={index}>
                            {detection.categories[0].categoryName} (Confidence: {detection.categories[0].score})
                        </li>
                    ))}
                </ul>
            </div>
        )}
      </section>
    </div>
  );
}

