import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Ammo from 'ammo.js';

// Debug flag
const DEBUG = true;

// Function to log debug messages
function debugLog(message) {
    if (DEBUG) {
        console.log(`[DEBUG] ${message}`);
    }
}

// Function to log errors
function errorLog(message, error) {
    console.error(`[ERROR] ${message}`, error);
}

// Check if Ammo.js is loaded
if (typeof Ammo === 'undefined') {
    errorLog('Ammo.js is not loaded!');
    if (window.showErrorMessage) {
        window.showErrorMessage('Physics engine (Ammo.js) failed to load!');
    }
} else {
    debugLog('Ammo.js loaded successfully');
    if (window.updateLoadingMessage) {
        window.updateLoadingMessage('Physics engine loaded, initializing scene...');
    }
}

let physicsWorld;
let scene, camera, renderer, controls;
let rigidBodies = [], tmpTrans;
let robot;

try {
    // Physics constants
    debugLog('Initializing physics world...');
    const gravityConstant = -9.8;
    const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
    const broadphase = new Ammo.btDbvtBroadphase();
    const solver = new Ammo.btSequentialImpulseConstraintSolver();
    physicsWorld = new Ammo.btDiscreteDynamicsWorld(
        dispatcher,
        broadphase,
        solver,
        collisionConfiguration
    );
    physicsWorld.setGravity(new Ammo.btVector3(0, -9.81, 0));
    debugLog('Physics world initialized successfully');

    // Configure physics solver
    // Note: Ammo.js doesn't expose direct solver configuration methods
    // We'll use the default settings which should work well for our simulation
    debugLog('Using default physics solver settings');

    // Scene setup
    debugLog('Setting up Three.js scene...');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    // Add error handling for scene creation
    if (!scene) {
        errorLog('Failed to create Three.js scene');
        throw new Error('Scene creation failed');
    }

    // Add more lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Add a hemisphere light for better ambient lighting
    const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
    scene.add(hemisphereLight);

    // Camera setup with error handling
    try {
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 5, 10);
        camera.lookAt(0, 0, 0);
        debugLog('Camera initialized successfully');
    } catch (error) {
        errorLog('Failed to initialize camera', error);
        throw error;
    }

    // Renderer setup with error handling
    try {
        renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: "high-performance"
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        debugLog('Renderer initialized successfully');
    } catch (error) {
        errorLog('Failed to initialize renderer', error);
        throw error;
    }

    // Check if viewport element exists
    const viewportElement = document.getElementById('viewport');
    if (!viewportElement) {
        errorLog('Viewport element not found in DOM');
        throw new Error('Viewport element not found in DOM');
    }

    try {
        viewportElement.appendChild(renderer.domElement);
        debugLog('Renderer DOM element added to viewport');
    } catch (error) {
        errorLog('Failed to append renderer to viewport', error);
        throw error;
    }
    debugLog('Three.js scene setup complete');

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Ground
    function createGround() {
        console.log('Creating ground...');
        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x808080,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);
        console.log('Ground added to scene');

        // Physics body for ground
        const groundShape = new Ammo.btStaticPlaneShape(new Ammo.btVector3(0, 1, 0), 0);
        const groundTransform = new Ammo.btTransform();
        groundTransform.setIdentity();
        const groundMotionState = new Ammo.btDefaultMotionState(groundTransform);
        const groundRbInfo = new Ammo.btRigidBodyConstructionInfo(0, groundMotionState, groundShape);
        const groundBody = new Ammo.btRigidBody(groundRbInfo);
        physicsWorld.addRigidBody(groundBody);
        console.log('Ground physics body added to physics world');
    }

    // Initialize physics
    debugLog('Creating ground...');
    tmpTrans = new Ammo.btTransform();
    createGround();

    // Create a controllable car instead of a cube
    function createCar() {
        // Create a group to hold all car parts
        const carGroup = new THREE.Group();
        
        // Car body
        const bodyGeometry = new THREE.BoxGeometry(2, 0.5, 4);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3366ff });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.5;
        carGroup.add(body);
        
        // Car roof
        const roofGeometry = new THREE.BoxGeometry(1.5, 0.4, 2);
        const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x3366ff });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = 1.2;
        roof.position.z = -0.2;
        carGroup.add(roof);
        
        // Windshield
        const windshieldGeometry = new THREE.BoxGeometry(1.5, 0.3, 0.1);
        const windshieldMaterial = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.7 });
        const windshield = new THREE.Mesh(windshieldGeometry, windshieldMaterial);
        windshield.position.y = 0.9;
        windshield.position.z = 0.8;
        carGroup.add(windshield);
        
        // Wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        
        // Front left wheel
        const wheelFL = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheelFL.rotation.z = Math.PI / 2;
        wheelFL.position.set(-1, 0.4, 1.2);
        carGroup.add(wheelFL);
        
        // Front right wheel
        const wheelFR = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheelFR.rotation.z = Math.PI / 2;
        wheelFR.position.set(1, 0.4, 1.2);
        carGroup.add(wheelFR);
        
        // Rear left wheel
        const wheelRL = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheelRL.rotation.z = Math.PI / 2;
        wheelRL.position.set(-1, 0.4, -1.2);
        carGroup.add(wheelRL);
        
        // Rear right wheel
        const wheelRR = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheelRR.rotation.z = Math.PI / 2;
        wheelRR.position.set(1, 0.4, -1.2);
        carGroup.add(wheelRR);
        
        // Headlights
        const headlightGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const headlightMaterial = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.5 });
        
        // Left headlight
        const headlightL = new THREE.Mesh(headlightGeometry, headlightMaterial);
        headlightL.position.set(-0.7, 0.5, 2);
        carGroup.add(headlightL);
        
        // Right headlight
        const headlightR = new THREE.Mesh(headlightGeometry, headlightMaterial);
        headlightR.position.set(0.7, 0.5, 2);
        carGroup.add(headlightR);
        
        // Taillights
        const taillightMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
        
        // Left taillight
        const taillightL = new THREE.Mesh(headlightGeometry, taillightMaterial);
        taillightL.position.set(-0.7, 0.5, -2);
        carGroup.add(taillightL);
        
        // Right taillight
        const taillightR = new THREE.Mesh(headlightGeometry, taillightMaterial);
        taillightR.position.set(0.7, 0.5, -2);
        carGroup.add(taillightR);
        
        // Direction indicator (small arrow on hood)
        const directionIndicatorGeometry = new THREE.ConeGeometry(0.2, 0.4, 3);
        const directionIndicatorMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });
        const directionIndicator = new THREE.Mesh(directionIndicatorGeometry, directionIndicatorMaterial);
        directionIndicator.position.set(0, 0.6, 1.8);
        directionIndicator.rotation.x = Math.PI / 2; // Point horizontally forward
        carGroup.add(directionIndicator);
        
        return carGroup;
    }

    // Create the car
    const car = createCar();
    car.position.set(0, 2, 0);
    scene.add(car);
    console.log('Added car to scene');

    // Add physics to the car
    const carShape = new Ammo.btBoxShape(new Ammo.btVector3(1, 0.25, 2));
    const carTransform = new Ammo.btTransform();
    carTransform.setIdentity();
    const carOrigin = new Ammo.btVector3(0, 2, 0);
    carTransform.setOrigin(carOrigin);
    const carMass = 1;
    const carInertia = new Ammo.btVector3(0, 0, 0);
    carShape.calculateLocalInertia(carMass, carInertia);
    const carMotionState = new Ammo.btDefaultMotionState(carTransform);
    const carRbInfo = new Ammo.btRigidBodyConstructionInfo(carMass, carMotionState, carShape, carInertia);
    const carBody = new Ammo.btRigidBody(carRbInfo);
    physicsWorld.addRigidBody(carBody);
    rigidBodies.push(carBody);
    console.log('Added physics to car');

    // Force vector visualization (disabled)
    const forceVectorGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
    const forceVectorMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const forceVectorMesh = new THREE.Mesh(forceVectorGeometry, forceVectorMaterial);
    forceVectorMesh.visible = false; // Always hidden
    scene.add(forceVectorMesh);

    // First person view toggle
    let isFirstPersonView = false;
    let firstPersonCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    firstPersonCamera.position.set(0, 1.5, 0); // Position at eye level
    car.add(firstPersonCamera);

    // Keyboard controls for the cube
    const keys = {};
    window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);

        const deltaTime = 1 / 60;
        const maxSubSteps = 3;
        
        // Update physics with interpolation
        physicsWorld.stepSimulation(deltaTime, maxSubSteps, deltaTime);

        // Handle car movement with WASD keys
        const moveForce = 50;
        const moveDirection = new THREE.Vector3();
        
        if (keys['w']) moveDirection.z -= 1;
        if (keys['s']) moveDirection.z += 1;
        if (keys['a']) moveDirection.x -= 1;
        if (keys['d']) moveDirection.x += 1;
        
        // Handle rotation with Q and E keys
        const rotationForce = 5;
        if (keys['q']) {
            // Apply counter-clockwise rotation
            carBody.applyTorque(
                new Ammo.btVector3(0, rotationForce, 0),
                true
            );
            console.log('Turning counter-clockwise');
        }
        if (keys['e']) {
            // Apply clockwise rotation
            carBody.applyTorque(
                new Ammo.btVector3(0, -rotationForce, 0),
                true
            );
            console.log('Turning clockwise');
        }
        
        // Handle jump with X key
        if (keys['x']) {
            // Apply upward force for jumping
            carBody.applyForce(
                new Ammo.btVector3(0, 200, 0),
                new Ammo.btVector3(0, 0, 0)
            );
            console.log('Jump activated');
        }
        
        // Toggle first person view with F key
        if (keys['f'] && !keys['f_wasPressed']) {
            isFirstPersonView = !isFirstPersonView;
            console.log('First person view:', isFirstPersonView ? 'enabled' : 'disabled');
            keys['f_wasPressed'] = true;
        } else if (!keys['f']) {
            keys['f_wasPressed'] = false;
        }
        
        // Debug key presses
        if (moveDirection.length() > 0) {
            console.log('Keys pressed:', Object.keys(keys).filter(k => keys[k]));
            console.log('Move direction:', moveDirection);
        }
        
        if (moveDirection.length() > 0) {
            moveDirection.normalize();
            // Apply force in the direction the camera is facing
            const cameraDirection = new THREE.Vector3();
            camera.getWorldDirection(cameraDirection);
            
            // Calculate the right vector (cross product of camera direction and up vector)
            const rightVector = new THREE.Vector3();
            rightVector.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();
            
            // Calculate the final force vector
            const forceVector = new THREE.Vector3();
            forceVector.addScaledVector(cameraDirection, moveDirection.z * moveForce);
            forceVector.addScaledVector(rightVector, moveDirection.x * moveForce);
            
            // Debug force application
            console.log('Applying force:', forceVector);
            
            // Force vector visualization is disabled
            
            carBody.applyForce(
                new Ammo.btVector3(forceVector.x, 0, forceVector.z),
                new Ammo.btVector3(0, 0, 0)
            );
            
            // Ensure the body is active
            carBody.activate(true);
        }

        // Update car visual position to match physics
        const ms = carBody.getMotionState();
        if (ms) {
            ms.getWorldTransform(tmpTrans);
            const p = tmpTrans.getOrigin();
            const q = tmpTrans.getRotation();
            car.position.set(p.x(), p.y(), p.z());
            car.quaternion.set(q.x(), q.y(), q.z(), q.w());
        }

        // Add performance monitoring
        if (typeof Stats !== 'undefined' && stats) {
            stats.begin();
        }

        // Update controls
        controls.update();
        
        // Render scene with appropriate camera
        if (isFirstPersonView) {
            renderer.render(scene, firstPersonCamera);
        } else {
            renderer.render(scene, camera);
        }
        
        // Log first frame render
        if (!window.firstFrameRendered) {
            console.log('First frame rendered');
            window.firstFrameRendered = true;
        }

        if (typeof Stats !== 'undefined' && stats) {
            stats.end();
        }
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Initialize help overlay
    const controlsHelp = document.getElementById('controls-help');
    if (controlsHelp) {
        controlsHelp.innerHTML = `
            <h3>Controls</h3>
            <p>W - Move forward</p>
            <p>S - Move backward</p>
            <p>A - Move left</p>
            <p>D - Move right</p>
            <p>Q - Turn counter-clockwise</p>
            <p>E - Turn clockwise</p>
            <p>X - Jump</p>
            <p>F - Toggle first-person view</p>
            <p>Mouse - Look around</p>
            <p>Scroll - Zoom in/out</p>
        `;
        controlsHelp.style.display = 'block';
        setTimeout(() => {
            controlsHelp.style.display = 'none';
        }, 5000);
    }

    // Hide loading indicator when everything is ready
    if (window.updateLoadingMessage) {
        window.updateLoadingMessage('Scene initialized, starting animation...');
        setTimeout(() => {
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        }, 1000);
    }

    debugLog('Starting animation loop');
    animate();

    // Add a simple function to check if the scene is rendering correctly
    function checkSceneRendering() {
        console.log('Checking scene rendering...');
        console.log('Scene children count:', scene.children.length);
        console.log('Camera position:', camera.position);
        console.log('Renderer size:', renderer.getSize(new THREE.Vector2()));
        
        // Take a screenshot of the scene
        const screenshot = renderer.domElement.toDataURL('image/png');
        console.log('Screenshot taken:', screenshot.substring(0, 100) + '...');
        
        // Check if the scene is visible
        const isVisible = document.visibilityState === 'visible';
        console.log('Document visibility:', isVisible);
        
        // Check if the viewport is visible
        const viewport = document.getElementById('viewport');
        if (viewport) {
            const viewportRect = viewport.getBoundingClientRect();
            console.log('Viewport dimensions:', viewportRect.width, 'x', viewportRect.height);
            console.log('Viewport visible:', viewportRect.width > 0 && viewportRect.height > 0);
        } else {
            console.error('Viewport element not found');
        }
    }

    // Call the function after a short delay
    setTimeout(checkSceneRendering, 2000);

    // Add a simple function to check if the Ammo.js physics engine is working correctly
    function checkPhysicsEngine() {
        console.log('Checking physics engine...');
        
        // Check if physics world is initialized
        if (!physicsWorld) {
            console.error('Physics world is not initialized');
            return;
        }
        
        // Check if gravity is set
        const gravity = physicsWorld.getGravity();
        console.log('Gravity:', gravity.x(), gravity.y(), gravity.z());
        
        // Check if there are any rigid bodies
        const numBodies = rigidBodies.length;
        console.log('Number of rigid bodies:', numBodies);
        
        // Check if the solver is working
        console.log('Physics engine check complete');
    }

    // Call the function after a short delay
    setTimeout(checkPhysicsEngine, 2000);

    // Add a simple function to check if the robot is being created correctly
    function checkRobotCreation() {
        console.log('Checking robot creation...');
        
        // Check if robot is initialized
        if (!robot) {
            console.error('Robot is not initialized');
            return;
        }
        
        // Check if robot group is added to scene
        if (!scene.children.includes(robot.group)) {
            console.error('Robot group is not added to scene');
        } else {
            console.log('Robot group is added to scene');
        }
        
        // Check if robot parts are created
        const expectedParts = [
            'torso', 'head', 
            'leftUpperArm', 'leftForearm', 
            'rightUpperArm', 'rightForearm',
            'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
            'rightUpperLeg', 'rightLowerLeg', 'rightFoot'
        ];
        
        const missingParts = expectedParts.filter(part => !robot.parts[part]);
        if (missingParts.length > 0) {
            console.error('Missing robot parts:', missingParts);
        } else {
            console.log('All robot parts are created');
        }
        
        // Check if robot constraints are created
        const expectedConstraints = [
            'neck',
            'leftShoulder', 'leftElbow',
            'rightShoulder', 'rightElbow',
            'leftHip', 'leftKnee', 'leftAnkle',
            'rightHip', 'rightKnee', 'rightAnkle'
        ];
        
        const missingConstraints = expectedConstraints.filter(constraint => !robot.constraints[constraint]);
        if (missingConstraints.length > 0) {
            console.error('Missing robot constraints:', missingConstraints);
        } else {
            console.log('All robot constraints are created');
        }
        
        console.log('Robot creation check complete');
    }

    // Call the function after a short delay
    setTimeout(checkRobotCreation, 2000);

    // Add UI functions
    window.togglePanel = function(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.toggle('collapsed');
        }
    };

    window.emergencyStop = function() {
        if (carBody) {
            // Stop all car movement
            carBody.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
            carBody.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
            console.log('Emergency stop activated');
        }
    };

    window.resetRobot = function() {
        if (carBody) {
            // Reset car position and velocity
            const resetTransform = new Ammo.btTransform();
            resetTransform.setIdentity();
            resetTransform.setOrigin(new Ammo.btVector3(0, 2, 0));
            
            // Update the motion state
            const motionState = carBody.getMotionState();
            if (motionState) {
                motionState.setWorldTransform(resetTransform);
            }
            
            // Update the physics body transform directly
            carBody.setWorldTransform(resetTransform);
            
            // Reset velocities
            carBody.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
            carBody.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
            
            // Activate the body to ensure it's in the simulation
            carBody.activate(true);
            
            console.log('Car reset to initial position');
        }
    };

    // Add camera preset function
    window.setCamera = function(preset) {
        if (!camera) return;
        
        switch(preset) {
            case 'front':
                // Front view
                camera.position.set(0, 5, 10);
                camera.lookAt(0, 0, 0);
                break;
            case 'top':
                // Top-down view
                camera.position.set(0, 10, 0);
                camera.lookAt(0, 0, 0);
                break;
            case 'side':
                // Side view
                camera.position.set(10, 5, 0);
                camera.lookAt(0, 0, 0);
                break;
            default:
                // Default view
                camera.position.set(0, 5, 10);
                camera.lookAt(0, 0, 0);
        }
        
        // Update controls target
        if (controls) {
            controls.target.set(0, 0, 0);
            controls.update();
        }
        
        console.log(`Camera set to ${preset} view`);
    };

    // Add placeholder functions for action buttons
    window.waveHand = function() {
        console.log('Wave hand action (not implemented)');
    };

    window.graspObject = function() {
        console.log('Grasp object action (not implemented)');
    };

    window.releaseObject = function() {
        console.log('Release object action (not implemented)');
    };

    window.shakeHand = function() {
        console.log('Shake hand action (not implemented)');
    };

    window.leanForward = function() {
        console.log('Lean forward action (not implemented)');
    };

    window.leanBackward = function() {
        console.log('Lean backward action (not implemented)');
    };

    window.toggleVoiceControl = function() {
        console.log('Toggle voice control (not implemented)');
    };

    // Create the environment
    function createEnvironment() {
        console.log('Creating environment...');
        
        // Create a road network
        createRoads();
        
        // Create trees
        createTrees();
        
        // Create buildings
        createBuildings();
        
        // Create obstacles
        createObstacles();
        
        // Create decorative elements
        createDecorations();
        
        console.log('Environment created successfully');
    }

    // Create a network of roads
    function createRoads() {
        // Main road material
        const roadMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            roughness: 0.9,
            metalness: 0.1
        });
        
        // Road markings material
        const markingMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            roughness: 0.5,
            metalness: 0.1
        });
        
        // Create main horizontal road
        const mainRoadGeometry = new THREE.PlaneGeometry(100, 10);
        const mainRoad = new THREE.Mesh(mainRoadGeometry, roadMaterial);
        mainRoad.rotation.x = -Math.PI / 2;
        mainRoad.position.y = 0.01; // Slightly above ground to prevent z-fighting
        scene.add(mainRoad);
        
        // Create main vertical road
        const verticalRoadGeometry = new THREE.PlaneGeometry(10, 100);
        const verticalRoad = new THREE.Mesh(verticalRoadGeometry, roadMaterial);
        verticalRoad.rotation.x = -Math.PI / 2;
        verticalRoad.position.y = 0.01;
        scene.add(verticalRoad);
        
        // Add road markings (center lines)
        const horizontalMarkingGeometry = new THREE.PlaneGeometry(100, 0.5);
        const horizontalMarking = new THREE.Mesh(horizontalMarkingGeometry, markingMaterial);
        horizontalMarking.rotation.x = -Math.PI / 2;
        horizontalMarking.position.y = 0.02;
        scene.add(horizontalMarking);
        
        const verticalMarkingGeometry = new THREE.PlaneGeometry(0.5, 100);
        const verticalMarking = new THREE.Mesh(verticalMarkingGeometry, markingMaterial);
        verticalMarking.rotation.x = -Math.PI / 2;
        verticalMarking.position.y = 0.02;
        scene.add(verticalMarking);
        
        // Add intersection markings
        for (let i = -40; i <= 40; i += 20) {
            if (i === 0) continue; // Skip center
            
            // Horizontal intersection markings
            const hMarkingGeometry = new THREE.PlaneGeometry(10, 0.5);
            const hMarking = new THREE.Mesh(hMarkingGeometry, markingMaterial);
            hMarking.rotation.x = -Math.PI / 2;
            hMarking.position.set(i, 0.02, 0);
            scene.add(hMarking);
            
            // Vertical intersection markings
            const vMarkingGeometry = new THREE.PlaneGeometry(0.5, 10);
            const vMarking = new THREE.Mesh(vMarkingGeometry, markingMaterial);
            vMarking.rotation.x = -Math.PI / 2;
            vMarking.position.set(0, 0.02, i);
            scene.add(vMarking);
        }
        
        // Add traffic cones as obstacles
        for (let i = -45; i <= 45; i += 10) {
            if (i === 0) continue; // Skip center
            
            // Create traffic cone
            const coneGeometry = new THREE.ConeGeometry(0.5, 1.5, 8);
            const coneMaterial = new THREE.MeshStandardMaterial({ color: 0xff6600 });
            const cone = new THREE.Mesh(coneGeometry, coneMaterial);
            cone.position.set(i, 0.75, 5.1);
            scene.add(cone);
            
            // Add physics to cone
            const coneShape = new Ammo.btConeShape(0.5, 1.5);
            const coneTransform = new Ammo.btTransform();
            coneTransform.setIdentity();
            const coneOrigin = new Ammo.btVector3(i, 0.75, 5.1);
            coneTransform.setOrigin(coneOrigin);
            const coneMass = 1;
            const coneInertia = new Ammo.btVector3(0, 0, 0);
            coneShape.calculateLocalInertia(coneMass, coneInertia);
            const coneMotionState = new Ammo.btDefaultMotionState(coneTransform);
            const coneRbInfo = new Ammo.btRigidBodyConstructionInfo(coneMass, coneMotionState, coneShape, coneInertia);
            const coneBody = new Ammo.btRigidBody(coneRbInfo);
            physicsWorld.addRigidBody(coneBody);
            rigidBodies.push(coneBody);
        }
    }

    // Create trees
    function createTrees() {
        // Tree trunk material
        const trunkMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8B4513,
            roughness: 0.9,
            metalness: 0.1
        });
        
        // Tree leaves material
        const leavesMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x228B22,
            roughness: 0.8,
            metalness: 0.1
        });
        
        // Create trees in a grid pattern
        for (let x = -45; x <= 45; x += 10) {
            for (let z = -45; z <= 45; z += 10) {
                // Skip the road area
                if (Math.abs(x) < 5 || Math.abs(z) < 5) continue;
                
                // Create tree trunk
                const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 2, 8);
                const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
                trunk.position.set(x, 1, z);
                scene.add(trunk);
                
                // Create tree leaves (cone)
                const leavesGeometry = new THREE.ConeGeometry(2, 4, 8);
                const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
                leaves.position.set(x, 3, z);
                scene.add(leaves);
                
                // Add physics to trunk
                const trunkShape = new Ammo.btCylinderShape(new Ammo.btVector3(0.5, 1, 0.5));
                const trunkTransform = new Ammo.btTransform();
                trunkTransform.setIdentity();
                const trunkOrigin = new Ammo.btVector3(x, 1, z);
                trunkTransform.setOrigin(trunkOrigin);
                const trunkMass = 10; // Trees are heavy and won't move much
                const trunkInertia = new Ammo.btVector3(0, 0, 0);
                trunkShape.calculateLocalInertia(trunkMass, trunkInertia);
                const trunkMotionState = new Ammo.btDefaultMotionState(trunkTransform);
                const trunkRbInfo = new Ammo.btRigidBodyConstructionInfo(trunkMass, trunkMotionState, trunkShape, trunkInertia);
                const trunkBody = new Ammo.btRigidBody(trunkRbInfo);
                trunkBody.setFriction(0.5);
                trunkBody.setRestitution(0.1);
                physicsWorld.addRigidBody(trunkBody);
                rigidBodies.push(trunkBody);
            }
        }
    }

    // Create buildings
    function createBuildings() {
        // Building materials
        const buildingMaterials = [
            new THREE.MeshStandardMaterial({ color: 0x808080 }), // Gray
            new THREE.MeshStandardMaterial({ color: 0xA52A2A }), // Brown
            new THREE.MeshStandardMaterial({ color: 0x4682B4 }), // Steel blue
            new THREE.MeshStandardMaterial({ color: 0x556B2F })  // Dark olive green
        ];
        
        // Create buildings in the corners
        const buildingPositions = [
            { x: -20, z: -20, width: 15, depth: 15, height: 10, materialIndex: 0 },
            { x: 20, z: -20, width: 15, depth: 15, height: 8, materialIndex: 1 },
            { x: -20, z: 20, width: 15, depth: 15, height: 12, materialIndex: 2 },
            { x: 20, z: 20, width: 15, depth: 15, height: 6, materialIndex: 3 }
        ];
        
        buildingPositions.forEach(building => {
            // Create building
            const buildingGeometry = new THREE.BoxGeometry(building.width, building.height, building.depth);
            const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterials[building.materialIndex]);
            buildingMesh.position.set(building.x, building.height / 2, building.z);
            scene.add(buildingMesh);
            
            // Add physics to building
            const buildingShape = new Ammo.btBoxShape(new Ammo.btVector3(building.width / 2, building.height / 2, building.depth / 2));
            const buildingTransform = new Ammo.btTransform();
            buildingTransform.setIdentity();
            const buildingOrigin = new Ammo.btVector3(building.x, building.height / 2, building.z);
            buildingTransform.setOrigin(buildingOrigin);
            const buildingMass = 0; // Static body
            const buildingInertia = new Ammo.btVector3(0, 0, 0);
            buildingShape.calculateLocalInertia(buildingMass, buildingInertia);
            const buildingMotionState = new Ammo.btDefaultMotionState(buildingTransform);
            const buildingRbInfo = new Ammo.btRigidBodyConstructionInfo(buildingMass, buildingMotionState, buildingShape, buildingInertia);
            const buildingBody = new Ammo.btRigidBody(buildingRbInfo);
            buildingBody.setFriction(0.5);
            buildingBody.setRestitution(0.1);
            physicsWorld.addRigidBody(buildingBody);
            rigidBodies.push(buildingBody);
        });
    }

    // Create obstacles
    function createObstacles() {
        // Create some random obstacles
        const obstacleTypes = [
            { type: 'box', width: 2, height: 1, depth: 2, color: 0xff0000 },
            { type: 'sphere', radius: 1, color: 0x00ff00 },
            { type: 'cylinder', radius: 1, height: 2, color: 0x0000ff }
        ];
        
        // Create obstacles in random positions
        for (let i = 0; i < 10; i++) {
            const obstacleType = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
            const x = (Math.random() - 0.5) * 80;
            const z = (Math.random() - 0.5) * 80;
            
            // Skip the road area
            if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
            
            let obstacleMesh;
            let obstacleShape;
            
            if (obstacleType.type === 'box') {
                // Create box obstacle
                const boxGeometry = new THREE.BoxGeometry(obstacleType.width, obstacleType.height, obstacleType.depth);
                const boxMaterial = new THREE.MeshStandardMaterial({ color: obstacleType.color });
                obstacleMesh = new THREE.Mesh(boxGeometry, boxMaterial);
                obstacleMesh.position.set(x, obstacleType.height / 2, z);
                scene.add(obstacleMesh);
                
                // Box physics shape
                obstacleShape = new Ammo.btBoxShape(new Ammo.btVector3(
                    obstacleType.width / 2, 
                    obstacleType.height / 2, 
                    obstacleType.depth / 2
                ));
            } else if (obstacleType.type === 'sphere') {
                // Create sphere obstacle
                const sphereGeometry = new THREE.SphereGeometry(obstacleType.radius, 16, 16);
                const sphereMaterial = new THREE.MeshStandardMaterial({ color: obstacleType.color });
                obstacleMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
                obstacleMesh.position.set(x, obstacleType.radius, z);
                scene.add(obstacleMesh);
                
                // Sphere physics shape
                obstacleShape = new Ammo.btSphereShape(obstacleType.radius);
            } else if (obstacleType.type === 'cylinder') {
                // Create cylinder obstacle
                const cylinderGeometry = new THREE.CylinderGeometry(obstacleType.radius, obstacleType.radius, obstacleType.height, 16);
                const cylinderMaterial = new THREE.MeshStandardMaterial({ color: obstacleType.color });
                obstacleMesh = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
                obstacleMesh.position.set(x, obstacleType.height / 2, z);
                scene.add(obstacleMesh);
                
                // Cylinder physics shape
                obstacleShape = new Ammo.btCylinderShape(new Ammo.btVector3(
                    obstacleType.radius, 
                    obstacleType.height / 2, 
                    obstacleType.radius
                ));
            }
            
            // Add physics to obstacle
            const obstacleTransform = new Ammo.btTransform();
            obstacleTransform.setIdentity();
            const obstacleOrigin = new Ammo.btVector3(x, obstacleMesh.position.y, z);
            obstacleTransform.setOrigin(obstacleOrigin);
            const obstacleMass = 5;
            const obstacleInertia = new Ammo.btVector3(0, 0, 0);
            obstacleShape.calculateLocalInertia(obstacleMass, obstacleInertia);
            const obstacleMotionState = new Ammo.btDefaultMotionState(obstacleTransform);
            const obstacleRbInfo = new Ammo.btRigidBodyConstructionInfo(obstacleMass, obstacleMotionState, obstacleShape, obstacleInertia);
            const obstacleBody = new Ammo.btRigidBody(obstacleRbInfo);
            obstacleBody.setFriction(0.5);
            obstacleBody.setRestitution(0.3);
            physicsWorld.addRigidBody(obstacleBody);
            rigidBodies.push(obstacleBody);
        }
    }

    // Create decorative elements
    function createDecorations() {
        // Create a fountain in the center
        const fountainBaseGeometry = new THREE.CylinderGeometry(3, 4, 1, 16);
        const fountainBaseMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
        const fountainBase = new THREE.Mesh(fountainBaseGeometry, fountainBaseMaterial);
        fountainBase.position.set(0, 0.5, 0);
        scene.add(fountainBase);
        
        // Fountain water
        const waterGeometry = new THREE.CylinderGeometry(2, 2, 0.5, 16);
        const waterMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x4444ff, 
            transparent: true, 
            opacity: 0.7,
            roughness: 0.1,
            metalness: 0.8
        });
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.position.set(0, 1.25, 0);
        scene.add(water);
        
        // Fountain center
        const centerGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 16);
        const centerMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        const center = new THREE.Mesh(centerGeometry, centerMaterial);
        center.position.set(0, 2, 0);
        scene.add(center);
        
        // Add some street lamps
        for (let i = -40; i <= 40; i += 20) {
            if (i === 0) continue; // Skip center
            
            // Create lamp post
            const postGeometry = new THREE.CylinderGeometry(0.2, 0.2, 5, 8);
            const postMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
            const post = new THREE.Mesh(postGeometry, postMaterial);
            post.position.set(i, 2.5, 5.1);
            scene.add(post);
            
            // Create lamp
            const lampGeometry = new THREE.SphereGeometry(0.5, 16, 16);
            const lampMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xffffcc, 
                emissive: 0xffffcc, 
                emissiveIntensity: 0.5 
            });
            const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
            lamp.position.set(i, 5, 5.1);
            scene.add(lamp);
            
            // Add point light
            const light = new THREE.PointLight(0xffffcc, 1, 20);
            light.position.set(i, 5, 5.1);
            scene.add(light);
        }
        
        // Add some benches
        for (let i = -30; i <= 30; i += 15) {
            if (i === 0) continue; // Skip center
            
            // Create bench
            const benchGeometry = new THREE.BoxGeometry(3, 0.5, 1);
            const benchMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
            const bench = new THREE.Mesh(benchGeometry, benchMaterial);
            bench.position.set(i, 0.25, 7);
            scene.add(bench);
            
            // Add physics to bench
            const benchShape = new Ammo.btBoxShape(new Ammo.btVector3(1.5, 0.25, 0.5));
            const benchTransform = new Ammo.btTransform();
            benchTransform.setIdentity();
            const benchOrigin = new Ammo.btVector3(i, 0.25, 7);
            benchTransform.setOrigin(benchOrigin);
            const benchMass = 10;
            const benchInertia = new Ammo.btVector3(0, 0, 0);
            benchShape.calculateLocalInertia(benchMass, benchInertia);
            const benchMotionState = new Ammo.btDefaultMotionState(benchTransform);
            const benchRbInfo = new Ammo.btRigidBodyConstructionInfo(benchMass, benchMotionState, benchShape, benchInertia);
            const benchBody = new Ammo.btRigidBody(benchRbInfo);
            benchBody.setFriction(0.5);
            benchBody.setRestitution(0.1);
            physicsWorld.addRigidBody(benchBody);
            rigidBodies.push(benchBody);
        }
    }

    // Create the environment
    createEnvironment();

    // Add physics to the car
    // ... existing code ...
} catch (e) {
    errorLog('An error occurred', e);
} 