import Ammo from 'ammo.js';

console.log('Testing Ammo.js initialization...');

try {
    // Check if Ammo.js is loaded
    if (typeof Ammo === 'undefined') {
        console.error('Ammo.js is not loaded!');
    } else {
        console.log('Ammo.js loaded successfully');
        
        // Try to create a simple physics object
        const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
        console.log('Created collision configuration');
        
        const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
        console.log('Created collision dispatcher');
        
        const broadphase = new Ammo.btDbvtBroadphase();
        console.log('Created broadphase');
        
        const solver = new Ammo.btSequentialImpulseConstraintSolver();
        console.log('Created solver');
        
        const physicsWorld = new Ammo.btDiscreteDynamicsWorld(
            dispatcher,
            broadphase,
            solver,
            collisionConfiguration
        );
        console.log('Created physics world');
        
        physicsWorld.setGravity(new Ammo.btVector3(0, -9.81, 0));
        console.log('Set gravity');
        
        console.log('Ammo.js test completed successfully');
    }
} catch (e) {
    console.error('Error testing Ammo.js:', e);
} 