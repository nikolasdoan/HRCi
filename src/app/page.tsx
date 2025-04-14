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
import React from 'react';
import { EyeIcon, InformationCircleIcon, MicrophoneIcon, PlayIcon } from "@heroicons/react/24/outline";

// Import TensorFlow.js dependencies
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

// Add keyframes for progress animation
const styles = `
  @keyframes progress {
    0% {
      width: 0%;
    }
    100% {
      width: 100%;
    }
  }

  .animate-progress {
    animation: progress 60s linear forwards;
  }
`;

// Add style tag to head
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

// Define speech recognition types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    mozSpeechRecognition: any;
    msSpeechRecognition: any;
  }
}

type SpeechRecognitionRef = {
  continuous: boolean;
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onstart: (event: any) => void;
  onend: (event: any) => void;
  onerror: (event: any) => void;
  onresult: (event: any) => void;
} | null;

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
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionRef>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [objectDetections, setObjectDetections] = useState<any[]>([]);
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  
  // Add state for action timing
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  const [lastAnnouncementTime, setLastAnnouncementTime] = useState(0);
  const actionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Vision-to-action configuration
  const [visionToActionConfig, setVisionToActionConfig] = useState({
    personDetected: "Move Forward",
    cellPhoneDetected: "Start robot interaction sequence",
    enabled: true
  });

  const [isVisionEnabled, setIsVisionEnabled] = useState(false);

  // Function to handle robot action execution with timeout
  const executeRobotAction = (action: string, shouldAnnounce: boolean = true) => {
    // Special handling for stop action
    if (action.toLowerCase() === 'stop') {
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current);
      }
      setIsActionInProgress(false);
      setRobotAction("");
      toast({
        title: "Action Stopped",
        description: "Current action has been terminated",
        variant: "default",
      });
      return;
    }

    // Don't start new action if one is in progress
    if (isActionInProgress) {
      toast({
        title: "Action in Progress",
        description: "Please wait for the current action to complete or press Stop",
        variant: "destructive",
      });
      return;
    }

    setRobotAction(action);
    setIsActionInProgress(true);

    // Only announce once when the action starts
    if (shouldAnnounce && synthRef.current) {
      const utterance = new SpeechSynthesisUtterance(`Starting ${action}`);
      utterance.volume = 0.8;
      utterance.rate = 1.0;
      synthRef.current.speak(utterance);
    }

    // Clear any existing timeout
    if (actionTimeoutRef.current) {
      clearTimeout(actionTimeoutRef.current);
    }

    // Set timeout for action completion (1 minute)
    actionTimeoutRef.current = setTimeout(() => {
      setIsActionInProgress(false);
      setRobotAction("");
      
      toast({
        title: "Action Complete",
        description: `Completed action: ${action}`,
        variant: "default",
      });
    }, 60000); // 1 minute timeout
  };

  // Update handleActionClick to use new execution function
  const handleActionClick = (action: string) => {
    executeRobotAction(action);
  };

  // Function to update vision-to-action configuration
  const updateVisionConfig = (objectType: string, action: string) => {
    setVisionToActionConfig(prev => ({
      ...prev,
      [objectType]: action
    }));
    
    toast({
      title: "Configuration Updated",
      description: `${objectType} detection will now trigger "${action}"`,
      variant: "default",
    });
  };

  // Toggle vision-to-action system
  const toggleVisionToAction = () => {
    setVisionToActionConfig(prev => ({
      ...prev,
      enabled: !prev.enabled
    }));
    
    toast({
      title: visionToActionConfig.enabled ? "Vision-to-Action Disabled" : "Vision-to-Action Enabled",
      description: visionToActionConfig.enabled ? 
        "The system will no longer automatically respond to detected objects" : 
        "The system will now automatically respond to detected objects",
      variant: "default",
    });
  };

  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        const loadedModel = await cocoSsd.load();
        setModel(loadedModel);
      } catch (error: any) {
        console.error("Failed to load TensorFlow.js model:", error);
        toast({
          variant: "destructive",
          title: "TensorFlow.js Load Error",
          description: error.message || "Failed to load the object detection model.",
        });
      }
    };

    loadModel();
  }, [toast]);

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
    let speechRecognition: any = null;
    let speechSynthesis: any = null;

    const loadSpeechAPI = async () => {
      if (typeof window !== "undefined") {
        try {
          // Try different browser implementations of SpeechRecognition
          const SpeechRecognitionImpl = 
            window.SpeechRecognition || 
            window.webkitSpeechRecognition || 
            window.mozSpeechRecognition || 
            window.msSpeechRecognition;

          if (SpeechRecognitionImpl) {
            recognitionRef.current = new SpeechRecognitionImpl();
            
            if (recognitionRef.current) {
              recognitionRef.current.continuous = false;
              recognitionRef.current.lang = "en-US";
              recognitionRef.current.interimResults = false;
              recognitionRef.current.maxAlternatives = 1;

              recognitionRef.current.onstart = () => {
                setIsListening(true);
                // Mimic audio feedback using speech synthesis
                if (synthRef.current) {
                  const utterance = new SpeechSynthesisUtterance("Listening...");
                  utterance.volume = 0.8;
                  utterance.rate = 1.0;
                  synthRef.current.speak(utterance);
                }
              };

              recognitionRef.current.onresult = (event: any) => {
                try {
                  if (event.results && event.results.length > 0) {
                    const transcript = Array.from(event.results)
                      .map((result: any) => result[0].transcript)
                      .join("");
                    setVoiceCommand(transcript);
                  }
                } catch (error) {
                  console.error("Error processing speech results:", error);
                }
              };

              recognitionRef.current.onend = () => {
                setIsListening(false);
              };

              recognitionRef.current.onerror = (event: any) => {
                console.error("Speech recognition error:", event.error);
                setIsListening(false);
                // Stop speech recognition service
                if (recognitionRef.current) {
                  try {
                    recognitionRef.current.stop();
                  } catch (e) {
                    console.log("Could not stop recognition that errored:", e);
                  }
                }
                
                // Better error message based on error type
                let errorMessage = "There was an error in processing your command.";
                if (event.error === "not-allowed") {
                  errorMessage = "Microphone access was denied. Please allow microphone permissions.";
                } else if (event.error === "network") {
                  errorMessage = "Network error occurred. Please check your connection.";
                } else if (event.error === "aborted") {
                  errorMessage = "Speech recognition was aborted. Please try again.";
                } else if (event.error === "no-speech") {
                  errorMessage = "No speech was detected. Please try speaking again.";
                }
                
                toast({
                  variant: "destructive",
                  title: "Speech Recognition Error",
                  description: errorMessage,
                });
              };
            }
          } else {
            toast({
              variant: "destructive",
              title: "Speech Recognition Not Supported",
              description: "Your browser does not support speech recognition.",
            });
          }

          speechSynthesis = window.speechSynthesis;
          synthRef.current = speechSynthesis;
        } catch (error: any) {
          console.error("Error loading speech API:", error);
          toast({
            variant: "destructive",
            title: "Speech API Load Error",
            description: "Failed to load speech recognition API: " + (error?.message || "Unknown error"),
          });
        }
      }
    };

    loadSpeechAPI();
  }, [toast]);

  const startListening = () => {
    if (recognitionRef.current) {
      try {
        // Reset previous voice command
        setVoiceCommand("");
        
        // Add a small delay to ensure previous sessions are cleaned up
        setTimeout(() => {
          recognitionRef.current?.start();
          
          // Safety timeout (browser might not fire onend)
          setTimeout(() => {
            if (isListening) {
              stopListening();
            }
          }, 10000); // 10 seconds timeout
        }, 100);
      } catch (error) {
        console.error("Error starting speech recognition:", error);
        setIsListening(false);
        toast({
          variant: "destructive",
          title: "Speech Recognition Error",
          description: "Failed to start speech recognition. Please try again."
        });
      }
    } else {
      toast({
        variant: "destructive",
        title: "Speech Recognition Not Available",
        description: "Speech recognition is not available in your browser."
      });
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error("Error stopping speech recognition:", error);
      } finally {
        setIsListening(false);
      }
    }
  };

  const handleVoiceCommand = async () => {
    try {
      const clarification = await clarifyRequirements({ command: voiceCommand });
      setClarifiedCommand(clarification.clarifiedCommand);

      // Check for vision control commands
      const lowerCommand = clarification.clarifiedCommand.toLowerCase();
      if (lowerCommand.includes("enable vision") || 
          lowerCommand.includes("turn on vision") || 
          lowerCommand.includes("open computer vision") ||
          lowerCommand.includes("start vision")) {
        setIsVisionEnabled(true);
        toast({
          title: "Computer Vision Enabled",
          description: "Computer vision system is now active",
          variant: "default",
        });
        return;
      } else if (lowerCommand.includes("disable vision") || 
                 lowerCommand.includes("turn off vision") ||
                 lowerCommand.includes("close computer vision") ||
                 lowerCommand.includes("stop vision")) {
        setIsVisionEnabled(false);
        toast({
          title: "Computer Vision Disabled",
          description: "Computer vision system is now inactive",
          variant: "default",
        });
        return;
      }

      const aiResult = await processVoiceCommand({ voiceCommand: clarification.clarifiedCommand });
      executeRobotAction(aiResult.action);

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

  const showConfirmationDialog = (action: string) => {
    // Voice announcement for confirmation
    if (synthRef.current) {
      const utterance = new SpeechSynthesisUtterance(
        `Person detected. Do you want to execute ${action}?`
      );
      utterance.volume = 0.8;
      utterance.rate = 1.0;
      synthRef.current.speak(utterance);
    }

    // Show visual confirmation
    toast({
      title: "Person Detected",
      description: `Person detected. Waiting for confirmation.`,
      variant: "default",
      duration: 10000,
    });
  };

  const detectObjects = async () => {
    if (!videoRef.current || !model || !isVisionEnabled) {
      return;
    }

    try {
      const predictions = await model.detect(videoRef.current);
      setObjectDetections(predictions);

      // Only trigger actions if vision-to-action is enabled and no action is in progress
      if (predictions && predictions.length > 0 && visionToActionConfig.enabled && !isActionInProgress) {
        for (const prediction of predictions) {
          if (isActionInProgress) break; // Stop checking if an action was triggered
          
          if (prediction.class === 'person') {
            executeRobotAction(visionToActionConfig.personDetected, true);
            break;
          } else if (prediction.class === 'cell phone') {
            executeRobotAction(visionToActionConfig.cellPhoneDetected, false);
            break;
          }
        }
      }
    } catch (error: any) {
      console.error("Object detection error:", error);
      toast({
        variant: 'destructive',
        title: "Object Detection Error",
        description: error.message || "Failed to detect objects."
      });
    }
  };

  useEffect(() => {
    let animationFrameId: number;

    const renderDetections = async () => {
      if (hasCameraPermission && model && videoRef.current && isVisionEnabled) {
        detectObjects();
        animationFrameId = requestAnimationFrame(renderDetections);
      }
    };

    renderDetections();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [hasCameraPermission, model, isVisionEnabled]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current);
      }
    };
  }, []);

  // Update UI to show action progress
  const getActionStatusText = () => {
    if (!robotAction) return null;
    if (isActionInProgress) {
      return `Executing: ${robotAction} (1 minute)`;
    }
    return robotAction;
  };

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Robot Control Panel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {ROBOT_ACTIONS.filter(action => action !== "Stop").map((action) => (
                  <Button
                    key={action}
                    onClick={() => handleActionClick(action.toLowerCase())}
                    disabled={isActionInProgress}
                    className="w-full"
                  >
                    {action}
                  </Button>
                ))}
              </div>

              {isActionInProgress && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Action in Progress</div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-progress"></div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Current action will complete in 1 minute
                  </p>
                </div>
              )}

              <Button
                onClick={() => handleActionClick("stop")}
                variant="destructive"
                size="lg"
                className="w-full py-6 text-lg font-bold"
              >
                STOP
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Voice Control</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert className="bg-blue-50 border-blue-200">
                <AlertTitle>Available Voice Commands</AlertTitle>
                <AlertDescription className="text-sm space-y-1">
                  <p>• All robot actions (e.g., "move forward", "turn left")</p>
                  <p>• Vision controls:</p>
                  <ul className="pl-4 list-disc">
                    <li>"open computer vision" / "enable vision"</li>
                    <li>"close computer vision" / "disable vision"</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {/* Voice Control Section */}
              {isListening && (
                <Alert className="bg-primary/10 text-primary border-primary/50 animate-pulse mb-4">
                  <AlertTitle className="text-lg">Listening...</AlertTitle>
                  <AlertDescription>
                    Speak your command clearly
                  </AlertDescription>
                </Alert>
              )}
              
              {voiceCommand && (
                <div className="p-4 mb-4 border border-green-300 rounded-md bg-green-50">
                  <p className="font-medium text-sm text-green-800">Recognized Command:</p>
                  <p className="text-lg font-medium">{voiceCommand}</p>
                </div>
              )}
              
              <div className="flex flex-col items-center gap-6 my-4">
                {/* Control Buttons */}
                <div className="flex items-center gap-6">
                  {/* Microphone Button */}
                  <Button
                    onClick={() => {
                      if (isListening) {
                        stopListening();
                      } else {
                        startListening();
                      }
                    }}
                    className={`w-20 h-20 rounded-full transition-all duration-300 shadow-lg ${
                      isListening 
                        ? 'bg-red-600 hover:bg-red-700 animate-pulse shadow-red-300' 
                        : 'bg-red-100 hover:bg-red-200'
                    }`}
                  >
                    <MicrophoneIcon className={`w-10 h-10 transition-colors duration-300 ${
                      isListening ? 'text-white' : 'text-red-600'
                    }`} />
                  </Button>

                  {/* Play Button */}
                  <Button
                    onClick={handleVoiceCommand}
                    disabled={!voiceCommand}
                    className={`w-16 h-16 rounded-full transition-all duration-300 shadow-lg ${
                      voiceCommand 
                        ? 'bg-green-600 hover:bg-green-700 shadow-green-300' 
                        : 'bg-green-100'
                    } ${!voiceCommand && 'opacity-50'}`}
                  >
                    <PlayIcon className={`w-8 h-8 transition-colors duration-300 ${
                      voiceCommand ? 'text-white' : 'text-green-600'
                    }`} />
                  </Button>
                </div>

                {/* Text Input - Optional for manual command entry */}
                <div className="w-full max-w-sm">
                  <Textarea
                    placeholder="Or type your command here..."
                    value={voiceCommand}
                    onChange={(e) => setVoiceCommand(e.target.value)}
                    className="h-20 resize-none text-lg"
                  />
                </div>
              </div>

              {clarifiedCommand && (
                <div className="p-4 border border-blue-300 rounded-md bg-blue-50">
                  <p className="font-medium text-sm text-blue-800">Clarified Command:</p>
                  <p className="text-lg">{clarifiedCommand}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Computer Vision</CardTitle>
            <Button
              onClick={() => setIsVisionEnabled(!isVisionEnabled)}
              variant={isVisionEnabled ? "destructive" : "default"}
              className="ml-4"
            >
              {isVisionEnabled ? "Disable Vision" : "Enable Vision"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!isVisionEnabled && (
              <Alert className="mb-4">
                <AlertTitle>Computer Vision Disabled</AlertTitle>
                <AlertDescription>
                  Enable computer vision to start object detection
                </AlertDescription>
              </Alert>
            )}
            
            {isVisionEnabled && objectDetections.length > 0 && (
              <Alert className="mb-4">
                <AlertTitle>Objects Detected</AlertTitle>
                <AlertDescription>
                  {objectDetections.map((obj, index) => (
                    <div key={index}>
                      {obj.class} (Confidence: {Math.round(obj.score * 100)}%)
                    </div>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-video bg-gray-100 rounded-lg"
            />
          </div>
        </CardContent>
      </Card>
      <Toaster />
    </div>
  );
}
