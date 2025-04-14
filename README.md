# HRCi - Human-Robot Control Interface

A modern web-based interface for controlling and interacting with robots using voice commands and computer vision.

## Features

- 🎤 Voice Control with natural language commands
- 👁️ Computer Vision integration for object detection and tracking
- 🤖 Intuitive Robot Control Panel
- 🚨 Emergency Stop functionality
- 💬 Real-time voice feedback
- 📱 Responsive design for various screen sizes

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)
- [Git](https://git-scm.com/)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/nikolasdoan/HRCi.git
cd HRCi
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory and add any necessary environment variables:
```bash
# Example .env.local
NEXT_PUBLIC_API_URL=your_api_url_here
```

4. Start the development server:
```bash
npm run dev
```

The application should now be running at `http://localhost:3000`

## Usage

### Voice Commands

The interface supports various voice commands for robot control:

#### Basic Commands
- "move forward" - Move the robot forward
- "go backward" - Move the robot backward
- "turn left/right" - Turn the robot left or right
- "stop" - Stop current action
- "emergency stop" - Immediately stop all actions

#### Vision Commands
- "enable vision" - Turn on computer vision
- "disable vision" - Turn off computer vision

#### Hand Actions
- "grasp object" - Pick up an object (requires vision)
- "release object" - Release held object
- "open/close gripper" - Control the gripper
- "wave hand" - Make the robot wave

#### Body Actions
- "lean forward/backward" - Control robot posture
- "lock/unlock pose" - Control robot pose
- "follow me" - Make robot follow person (requires vision)

### Using the Interface

1. **Voice Control**
   - Click the microphone button to start voice recognition
   - Speak your command clearly
   - The recognized command will appear in the text area
   - Click the play button to execute the command

2. **Computer Vision**
   - Enable vision using the "Enable Vision" button
   - Vision-dependent actions will be marked with an eye icon
   - The camera feed will show detected objects when vision is enabled

3. **Manual Control**
   - Use the Robot Control Panel buttons for direct control
   - Actions are organized into Locomotion, Hand Actions, and Body Actions
   - The Emergency Stop button will immediately halt all actions

## Development

### Project Structure
```
HRCi/
├── src/
│   ├── app/           # Next.js app directory
│   ├── components/    # React components
│   ├── lib/          # Utility functions
│   └── styles/       # CSS styles
├── public/           # Static files
└── package.json      # Project dependencies
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests

## Troubleshooting

### Common Issues

1. **Speech Recognition not working**
   - Ensure your browser supports the Web Speech API
   - Check microphone permissions in your browser
   - Try using Chrome or Edge for best compatibility

2. **Computer Vision issues**
   - Make sure your camera permissions are enabled
   - Check if your browser supports WebRTC
   - Ensure adequate lighting for better object detection

3. **Robot Connection Issues**
   - Verify the robot's network connection
   - Check if the robot's API endpoint is accessible
   - Ensure all required services are running

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Heroicons](https://heroicons.com/)
