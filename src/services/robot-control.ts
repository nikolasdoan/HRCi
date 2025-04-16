import { EventEmitter } from 'events';

class RobotControlService extends EventEmitter {
    private ws: WebSocket | null = null;
    private static instance: RobotControlService;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectTimeout = 1000;

    private constructor() {
        super();
        this.connect();
    }

    public static getInstance(): RobotControlService {
        if (!RobotControlService.instance) {
            RobotControlService.instance = new RobotControlService();
        }
        return RobotControlService.instance;
    }

    private connect() {
        try {
            this.ws = new WebSocket('ws://localhost:9003');

            this.ws.onopen = () => {
                console.log('Connected to robot simulation');
                this.reconnectAttempts = 0;
                this.emit('connected');
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.emit('robotUpdate', data);
                } catch (error) {
                    console.error('Error parsing robot update:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('Disconnected from robot simulation');
                this.emit('disconnected');
                this.handleReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.emit('error', error);
            };
        } catch (error) {
            console.error('Error connecting to robot simulation:', error);
            this.handleReconnect();
        }
    }

    private handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), this.reconnectTimeout);
        }
    }

    public sendCommand(command: string, params: any = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ command, params }));
        } else {
            console.error('WebSocket is not connected');
        }
    }

    // Robot control methods
    public moveForward(distance: number = 1) {
        this.sendCommand('moveForward', { distance });
    }

    public moveBackward(distance: number = 1) {
        this.sendCommand('moveBackward', { distance });
    }

    public turnLeft(degrees: number = 90) {
        this.sendCommand('turnLeft', { degrees });
    }

    public turnRight(degrees: number = 90) {
        this.sendCommand('turnRight', { degrees });
    }

    public setJointRotation(jointName: string, angle: number) {
        this.sendCommand('setJointRotation', { jointName, angle });
    }

    public graspObject() {
        this.sendCommand('graspObject');
    }

    public releaseObject() {
        this.sendCommand('releaseObject');
    }

    public openGripper() {
        this.sendCommand('openGripper');
    }

    public closeGripper() {
        this.sendCommand('closeGripper');
    }

    public waveHand() {
        this.sendCommand('waveHand');
    }

    public shakeHand() {
        this.sendCommand('shakeHand');
    }

    public pointTo(x: number, y: number, z: number) {
        this.sendCommand('pointTo', { x, y, z });
    }

    public leanForward(angle: number = 15) {
        this.sendCommand('leanForward', { angle });
    }

    public leanBackward(angle: number = 15) {
        this.sendCommand('leanBackward', { angle });
    }

    public lockPose() {
        this.sendCommand('lockPose');
    }

    public unlockPose() {
        this.sendCommand('unlockPose');
    }

    public followPerson() {
        this.sendCommand('followPerson');
    }

    public emergencyStop() {
        this.sendCommand('emergencyStop');
    }
}

export const robotControlService = RobotControlService.getInstance(); 