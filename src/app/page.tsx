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
import RobotMap from "@/components/RobotMap";

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

// Define robot action categories and their functions
const ROBOT_ACTIONS = {
  locomotion: [
    { name: "Go Forward", value: "go_forward", requiresVision: false },
    { name: "Go Backward", value: "go_backward", requiresVision: false },
    { name: "Turn Left", value: "turn_left", requiresVision: false },
    { name: "Turn Right", value: "turn_right", requiresVision: false },
    { name: "Return to Origin", value: "return_to_origin", requiresVision: false }
  ],
  handActions: [
    { name: "Grasp Object", value: "grasp_object", requiresVision: true },
    { name: "Release Object", value: "release_object", requiresVision: false },
    { name: "Open Gripper", value: "open_gripper", requiresVision: false },
    { name: "Close Gripper", value: "close_gripper", requiresVision: false },
    { name: "Put Down Object", value: "put_down_object", requiresVision: true },
    { name: "Categorize Objects", value: "categorize_objects", requiresVision: true },
    { name: "Wave Hand", value: "wave_hand", requiresVision: false },
    { name: "Shake Hand", value: "shake_hand", requiresVision: true },
    { name: "Point To", value: "point_to", requiresVision: true }
  ],
  bodyActions: [
    { name: "Lean Forward", value: "lean_forward", requiresVision: false },
    { name: "Lean Backward", value: "lean_backward", requiresVision: false },
    { name: "Lock Pose", value: "lock_pose", requiresVision: false },
    { name: "Unlock Pose", value: "unlock_pose", requiresVision: false },
    { name: "Follow Person", value: "follow_person", requiresVision: true },
    { name: "Emergency Stop", value: "emergency_stop", requiresVision: false }
  ]
};

// Define the voice command categories for the info modal
const VOICE_COMMAND_HELP = {
  basic: [
    { command: "move forward", description: "Move the robot forward" },
    { command: "go backward", description: "Move the robot backward" },
    { command: "turn left", description: "Turn the robot left" },
    { command: "turn right", description: "Turn the robot right" },
    { command: "stop", description: "Stop current action" },
    { command: "emergency stop", description: "Immediately stop all actions" }
  ],
  vision: [
    { command: "enable vision", description: "Turn on computer vision" },
    { command: "disable vision", description: "Turn off computer vision" }
  ],
  hand: [
    { command: "grasp object", description: "Pick up an object (requires vision)" },
    { command: "release object", description: "Release held object" },
    { command: "open gripper", description: "Open the robot's gripper" },
    { command: "close gripper", description: "Close the robot's gripper" },
    { command: "wave hand", description: "Make the robot wave" }
  ],
  body: [
    { command: "lean forward", description: "Lean the robot forward" },
    { command: "lean backward", description: "Lean the robot backward" },
    { command: "lock pose", description: "Lock current robot pose" },
    { command: "unlock pose", description: "Unlock robot pose" },
    { command: "follow me", description: "Make robot follow person (requires vision)" }
  ]
};

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

  const [showCommandInfo, setShowCommandInfo] = useState(false);

  // Add state for robot position and path
  const [robotPosition, setRobotPosition] = useState({ x: 0, y: 0 });
  const [robotPath, setRobotPath] = useState([{ x: 0, y: 0 }]);
  const [robotDirection, setRobotDirection] = useState(0); // 0 degrees = facing right

  // Function to handle robot action execution with timeout
  const executeRobotAction = (action: string, shouldAnnounce: boolean = true) => {
    // Special handling for emergency stop action
    if (action.toLowerCase() === 'emergency_stop') {
      // Clear any existing timeout
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current);
      }
      // Stop all actions
      setIsActionInProgress(false);
      setRobotAction("");
      setIsVisionEnabled(false);
      setObjectDetections([]);
      
      // Announce emergency stop
      if (synthRef.current) {
        const utterance = new SpeechSynthesisUtterance("Stopped all actions.");
        utterance.volume = 0.8;
        utterance.rate = 1.0;
        synthRef.current.speak(utterance);
      }

      toast({
        title: "Emergency Stop",
        description: "Stopped all actions",
        variant: "destructive",
      });
      return;
    }
    
    // Parse the action to update robot position and direction
    const actionLower = action.toLowerCase();
    
    // Handle turning actions
    if (actionLower.includes('turn')) {
      let newDirection = robotDirection;
      
      if (actionLower.includes('left')) {
        // Extract degrees if specified, otherwise use 90
        const degreesMatch = actionLower.match(/(\d+)\s*degrees?/);
        const degrees = degreesMatch ? parseInt(degreesMatch[1]) : 90;
        newDirection = (robotDirection + degrees) % 360;
      } else if (actionLower.includes('right')) {
        const degreesMatch = actionLower.match(/(\d+)\s*degrees?/);
        const degrees = degreesMatch ? parseInt(degreesMatch[1]) : 90;
        newDirection = (robotDirection - degrees + 360) % 360;
      }
      
      setRobotDirection(newDirection);
      
      // Announce the turn
      if (synthRef.current && shouldAnnounce) {
        const degreesMatch = actionLower.match(/(\d+)\s*degrees?/);
        const degreesText = degreesMatch ? `${degreesMatch[1]} degrees` : '90 degrees';
        const direction = actionLower.includes('left') ? 'left' : 'right';
        const utterance = new SpeechSynthesisUtterance(`Turning ${direction} ${degreesText}`);
        utterance.volume = 0.8;
        utterance.rate = 1.0;
        synthRef.current.speak(utterance);
      }
    }
    
    // Handle movement actions
    if (actionLower.includes('move') || actionLower.includes('forward') || actionLower.includes('backward') || 
        actionLower.includes('go forward') || actionLower.includes('go backward')) {
      let steps = 1;
      const stepsMatch = actionLower.match(/(\d+)\s*steps?/);
      if (stepsMatch) {
        steps = parseInt(stepsMatch[1]);
      }
      
      // Determine if moving forward or backward
      const isBackward = actionLower.includes('backward') || actionLower.includes('back');
      
      // Calculate new position based on direction
      const radians = (robotDirection * Math.PI) / 180;
      const dx = Math.cos(radians) * steps * (isBackward ? -1 : 1);
      const dy = Math.sin(radians) * steps * (isBackward ? -1 : 1);
      
      const newPosition = {
        x: robotPosition.x + dx,
        y: robotPosition.y + dy
      };
      
      setRobotPosition(newPosition);
      setRobotPath([...robotPath, newPosition]);
      
      // Announce the movement
      if (synthRef.current && shouldAnnounce) {
        const direction = isBackward ? 'backward' : 'forward';
        const utterance = new SpeechSynthesisUtterance(`Moving ${direction} ${steps} ${steps > 1 ? 'steps' : 'step'}`);
        utterance.volume = 0.8;
        utterance.rate = 1.0;
        synthRef.current.speak(utterance);
      }
    }
    
    // Handle return to origin command
    if (actionLower.includes('return to origin') || actionLower.includes('go back to start')) {
      // Reset position to origin
      setRobotPosition({ x: 0, y: 0 });
      setRobotPath([{ x: 0, y: 0 }]);
      
      // Announce return to origin
      if (synthRef.current && shouldAnnounce) {
        const utterance = new SpeechSynthesisUtterance("Returning to origin");
        utterance.volume = 0.8;
        utterance.rate = 1.0;
        synthRef.current.speak(utterance);
      }
    }
    
    // Don't start new action if one is in progress
    if (isActionInProgress) {
      toast({
        title: "Action in Progress",
        description: "Please wait for the current action to complete or use Emergency Stop",
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

  const handleActionClick = (actionValue: string) => {
    const allActions = [...ROBOT_ACTIONS.locomotion, ...ROBOT_ACTIONS.handActions, ...ROBOT_ACTIONS.bodyActions];
    const action = allActions.find(a => a.value === actionValue);
    
    if (!action) return;

    // Check if vision is required but not enabled
    if (action.requiresVision && !isVisionEnabled) {
      toast({
        title: "Vision Required",
        description: "This action requires computer vision. Please enable vision first.",
        variant: "destructive",
      });
      return;
    }

    executeRobotAction(action.value);
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
            speechRecognition = new SpeechRecognitionImpl();
            recognitionRef.current = speechRecognition;
            
            if (speechRecognition) {
              speechRecognition.continuous = false;
              speechRecognition.lang = "en-US";
              speechRecognition.interimResults = false;
              speechRecognition.maxAlternatives = 1;

              speechRecognition.onstart = () => {
                setIsListening(true);
                // Mimic audio feedback using speech synthesis
                if (synthRef.current) {
                  const utterance = new SpeechSynthesisUtterance("Listening...");
                  utterance.volume = 0.8;
                  utterance.rate = 1.0;
                  synthRef.current.speak(utterance);
                }
              };

              speechRecognition.onresult = (event: any) => {
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

              speechRecognition.onend = () => {
                setIsListening(false);
              };

              speechRecognition.onerror = (event: any) => {
                console.error("Speech recognition error:", event.error);
                
                // Don't show error for aborted recognition (happens on normal stop)
                if (event.error !== 'aborted') {
                  // Better error message based on error type
                  let errorMessage = "There was an error in processing your command.";
                  if (event.error === "not-allowed") {
                    errorMessage = "Microphone access was denied. Please allow microphone permissions.";
                  } else if (event.error === "network") {
                    errorMessage = "Network error occurred. Please check your connection.";
                  } else if (event.error === "no-speech") {
                    errorMessage = "No speech was detected. Please try speaking again.";
                  }
                  
                  toast({
                    variant: "destructive",
                    title: "Speech Recognition Error",
                    description: errorMessage,
                  });
                }
                
                setIsListening(false);
                // Ensure recognition is properly stopped
                try {
                  speechRecognition.stop();
                } catch (e) {
                  console.log("Could not stop recognition that errored:", e);
                }
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

    // Cleanup function
    return () => {
      if (speechRecognition) {
        try {
          speechRecognition.stop();
        } catch (e) {
          console.log("Error stopping recognition during cleanup:", e);
        }
      }
    };
  }, [toast]);

  const startListening = () => {
    if (recognitionRef.current) {
      try {
        // Reset previous voice command
        setVoiceCommand("");
        
        // Ensure any existing recognition is stopped first
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors here as the recognition might not be active
        }
        
        // Add a small delay before starting new recognition
        setTimeout(() => {
          try {
            recognitionRef.current?.start();
            
            // Safety timeout (browser might not fire onend)
            setTimeout(() => {
              if (isListening) {
                stopListening();
              }
            }, 10000); // 10 seconds timeout
          } catch (e) {
            console.error("Error starting delayed recognition:", e);
            setIsListening(false);
          }
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
    if (recognitionRef.current) {
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
      const result = await processVoiceCommand({ voiceCommand });
      
      // If clarification is needed, ask for it
      if (result.needsClarification) {
        const clarification = await clarifyRequirements({ 
          command: voiceCommand,
          clarificationType: result.clarificationType
        });
        setClarifiedCommand(clarification.clarifiedCommand);
      }

      // Check for vision control commands
      const lowerCommand = clarifiedCommand.toLowerCase();
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

      executeRobotAction(result.action);

      // Mimic audio feedback using speech synthesis
      if (synthRef.current) {
        const utterance = new SpeechSynthesisUtterance(result.feedback);
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Robot Control Panel */}
        <div className="space-y-6">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Robot Control Panel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Locomotion Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-2">Locomotion</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {ROBOT_ACTIONS.locomotion
                      .filter(action => action.value !== "emergency_stop")
                      .map((action) => (
                        <Button
                          key={action.value}
                          onClick={() => handleActionClick(action.value)}
                          disabled={isActionInProgress}
                          className="w-full"
                        >
                          {action.name}
                        </Button>
                      ))}
                  </div>
                </div>

                {/* Hand Actions Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-2">Hand Actions</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {ROBOT_ACTIONS.handActions.map((action) => (
                      <Button
                        key={action.value}
                        onClick={() => handleActionClick(action.value)}
                        disabled={isActionInProgress || (action.requiresVision && !isVisionEnabled)}
                        className={`w-full ${action.requiresVision ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                      >
                        {action.name}
                        {action.requiresVision && <EyeIcon className="w-4 h-4 ml-2" />}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Body Actions Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-2">Body Actions</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {ROBOT_ACTIONS.bodyActions
                      .filter(action => action.value !== "emergency_stop")
                      .map((action) => (
                        <Button
                          key={action.value}
                          onClick={() => handleActionClick(action.value)}
                          disabled={isActionInProgress || (action.requiresVision && !isVisionEnabled)}
                          className={`w-full ${action.requiresVision ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                        >
                          {action.name}
                          {action.requiresVision && <EyeIcon className="w-4 h-4 ml-2" />}
                        </Button>
                      ))}
                  </div>
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
                  onClick={() => handleActionClick("emergency_stop")}
                  variant="destructive"
                  size="lg"
                  className="w-full py-6 text-lg font-bold"
                >
                  EMERGENCY STOP
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Middle Column - Voice Control and Computer Vision */}
        <div className="space-y-6">
          <Card className="mb-4">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Voice Control</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCommandInfo(!showCommandInfo)}
                  className={`h-8 w-8 transition-transform duration-200 ${showCommandInfo ? 'rotate-180' : ''}`}
                >
                  <InformationCircleIcon className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertTitle className="flex items-center justify-between">
                    Quick Voice Commands
                  </AlertTitle>
                  <AlertDescription className="text-sm space-y-2">
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <p className="font-medium mb-1">Movement:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>"move forward"</li>
                          <li>"turn left/right"</li>
                          <li>"stop"</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium mb-1">Vision:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>"enable vision"</li>
                          <li>"disable vision"</li>
                        </ul>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Press (i) for full command list →
                    </p>
                  </AlertDescription>
                </Alert>

                {isListening && (
                  <Alert className="bg-primary/10 text-primary border-primary/50 animate-pulse">
                    <AlertTitle>Listening...</AlertTitle>
                    <AlertDescription>
                      I'm listening to your voice command. Speak clearly.
                    </AlertDescription>
                  </Alert>
                )}
                
                {voiceCommand && (
                  <div className="p-4 border border-green-300 rounded-md bg-green-50">
                    <p className="font-medium text-sm text-green-800">Recognized Command:</p>
                    <p className="text-lg">{voiceCommand}</p>
                  </div>
                )}
                
                <Textarea
                  placeholder="Enter text command here..."
                  value={voiceCommand}
                  onChange={(e) => setVoiceCommand(e.target.value)}
                  className="h-24 resize-none"
                />
                
                <div className="flex justify-center items-center gap-4">
                  <Button
                    onClick={() => {
                      if (isListening) {
                        stopListening();
                      } else {
                        startListening();
                      }
                    }}
                    className={`w-16 h-16 rounded-full transition-all duration-300 ${
                      isListening 
                        ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                        : 'bg-red-100 hover:bg-red-200'
                    }`}
                  >
                    <MicrophoneIcon className={`w-8 h-8 transition-colors duration-300 ${
                      isListening ? 'text-white' : 'text-red-600'
                    }`} />
                  </Button>

                  <Button
                    onClick={handleVoiceCommand}
                    disabled={!voiceCommand}
                    className={`w-12 h-12 rounded-full transition-all duration-300 ${
                      voiceCommand 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-green-100'
                    }`}
                  >
                    <PlayIcon className={`w-6 h-6 transition-colors duration-300 ${
                      voiceCommand ? 'text-white' : 'text-green-600'
                    }`} />
                  </Button>
                </div>

                {clarifiedCommand && (
                  <div className="p-4 border border-blue-300 rounded-md bg-blue-50">
                    <p className="font-medium text-sm text-blue-800">Clarified Command:</p>
                    <p>{clarifiedCommand}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

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
                  <Alert>
                    <AlertTitle>Computer Vision Disabled</AlertTitle>
                    <AlertDescription>
                      Enable computer vision to use vision-dependent actions (marked with <EyeIcon className="w-4 h-4 inline" />)
                    </AlertDescription>
                  </Alert>
                )}
                
                {isVisionEnabled && objectDetections.length > 0 && (
                  <Alert>
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
        </div>

        {/* Right Column - Available Voice Commands */}
        <div className={`space-y-6 transition-all duration-300 ${showCommandInfo ? 'opacity-100' : 'opacity-0'}`}>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Available Voice Commands</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[calc(100vh-8rem)] overflow-y-auto">
              <div className="space-y-6">
                {Object.entries(VOICE_COMMAND_HELP).map(([category, commands]) => (
                  <div key={category} className="border-b pb-4 last:border-0">
                    <h3 className="text-md font-semibold capitalize mb-3 text-gray-700">{category} Commands</h3>
                    <div className="space-y-2">
                      {commands.map((cmd, index) => (
                        <div key={index} className="flex flex-col gap-1">
                          <span className="inline-block bg-blue-100 text-blue-800 rounded px-2 py-1 text-sm font-medium w-fit">
                            "{cmd.command}"
                          </span>
                          <span className="text-gray-600 text-sm pl-2">
                            {cmd.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="text-md font-semibold text-blue-800 mb-3">Tips</h3>
                  <ul className="space-y-2 text-sm text-blue-700">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-700 rounded-full"></span>
                      Speak clearly and naturally
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-700 rounded-full"></span>
                      Commands with 👁️ require computer vision
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-700 rounded-full"></span>
                      Use "emergency stop" to immediately stop all actions
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-700 rounded-full"></span>
                      You can combine commands like "enable vision and move forward"
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add the RobotMap component */}
      <div className="w-full max-w-3xl mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Robot Position</CardTitle>
          </CardHeader>
          <CardContent>
            <RobotMap
              currentPosition={robotPosition}
              path={robotPath}
              direction={robotDirection}
              gridSize={11}
            />
          </CardContent>
        </Card>
      </div>

      <Toaster />
    </div>
  );
}
