import pybullet as p
import pybullet_data
import time

# Connect to the physics server (GUI or DIRECT mode)
physicsClient = p.connect(p.GUI)

# Add search path for PyBullet data
p.setAdditionalSearchPath(pybullet_data.getDataPath())

# Set gravity
p.setGravity(0, 0, -10)

# Load models
planeId = p.loadURDF("plane.urdf")
cubeStartPos = [0, 0, 1]
cubeStartOrientation = p.getQuaternionFromEuler([0, 0, 0])
boxId = p.loadURDF("r2d2.urdf", cubeStartPos, cubeStartOrientation)

# Movement parameters
linear_velocity = 2.0  # Forward/backward speed
angular_velocity = 1.0  # Turning speed

print("Controls:")
print("I/K - Move forward/backward")
print("J/L - Turn left/right")
print("Q - Quit simulation")

# Run simulation until the user presses 'Q'
while p.isConnected():
    p.stepSimulation()
    
    # Get current position and orientation
    cubePos, cubeOrn = p.getBasePositionAndOrientation(boxId)
    
    # Get keyboard events
    keys = p.getKeyboardEvents()
    
    # Initialize velocities
    linear_vel = [0, 0, 0]
    angular_vel = [0, 0, 0]
    
    # Process keyboard events
    for key, state in keys.items():
        if state == p.KEY_WAS_TRIGGERED:
            if key == ord('i'):  # Forward
                linear_vel = [linear_velocity, 0, 0]
            elif key == ord('k'):  # Backward
                linear_vel = [-linear_velocity, 0, 0]
            elif key == ord('j'):  # Turn left
                angular_vel = [0, 0, angular_velocity]
            elif key == ord('l'):  # Turn right
                angular_vel = [0, 0, -angular_velocity]
            elif key == ord('q'):  # Quit
                p.disconnect()
                exit()
    
    # Apply velocities to the robot's base
    p.resetBaseVelocity(boxId, linear_vel, angular_vel)
    
    # Print position less frequently to avoid flooding the console
    if int(time.time() * 10) % 10 == 0:  # Print roughly once per second
        print(f"Position: {cubePos}, Orientation: {cubeOrn}")
        
    time.sleep(0.01)  # Small delay to prevent excessive CPU usage

# Disconnect from the server
p.disconnect()
