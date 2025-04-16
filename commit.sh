#!/bin/bash

# Navigate to the project root
cd /home/asrlab/Desktop/HRCi-master

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo "Initializing git repository..."
  git init
fi

# Create and switch to the sim branch
echo "Creating sim branch..."
git checkout -b sim

# Add all changes
echo "Adding changes..."
git add .

# Commit the changes
echo "Committing changes..."
git commit -m "Added detailed environment with roads, buildings, trees, and obstacles"

# Push to the sim branch
echo "Pushing to sim branch..."
git push --set-upstream origin sim

echo "Done!" 