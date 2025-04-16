#!/bin/bash

# Function to kill process using a port
kill_port() {
    pid=$(lsof -t -i:$1)
    if [ ! -z "$pid" ]; then
        echo "Killing process using port $1"
        kill $pid
        sleep 1
    fi
}

# Function to check and install dependencies
check_dependencies() {
    echo "Checking dependencies for $1..."
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies for $1..."
        npm install
    fi
}

# Kill any processes using our ports
kill_port 9002  # Control app port
kill_port 9003  # WebSocket port
kill_port 5173  # Vite default port
kill_port 5174  # Vite alternative port

# Setup control app
echo "Setting up control app..."
check_dependencies "control app"

# Setup robot simulation
echo "Setting up robot simulation..."
cd robot-sim
check_dependencies "robot simulation"
cd ..

# Start the control app
echo "Starting Control App on port 9002..."
npm run dev &

# Wait for control app to initialize
sleep 3

# Start the robot simulation
echo "Starting Robot Simulation..."
cd robot-sim && PORT=5173 npm run dev &

# Print access URLs
echo "----------------------------------------"
echo "Access the applications at:"
echo "Control App: http://localhost:9002"
echo "Robot Simulation: http://localhost:5173"
echo "----------------------------------------"

# Wait for both processes
wait 