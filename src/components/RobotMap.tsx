import React, { useEffect, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface RobotMapProps {
  currentPosition: Position;
  path: Position[];
  direction: number; // in degrees, 0 is North, 90 is East, 180 is South, 270 is West
  gridSize?: number; // number of cells in each direction
}

const RobotMap: React.FC<RobotMapProps> = ({
  currentPosition,
  path,
  direction,
  gridSize = 11, // Default to 11x11 grid (5 in each direction from center)
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Calculate the center of the grid
  const center = Math.floor(gridSize / 2);
  
  // Convert grid coordinates to canvas coordinates
  const gridToCanvas = (x: number, y: number, cellSize: number) => {
    return {
      x: (x + center) * cellSize,
      y: (center - y) * cellSize, // Invert y-axis for top-down view
    };
  };
  
  // Draw the map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate cell size based on canvas size
    const cellSize = Math.min(
      canvas.width / gridSize,
      canvas.height / gridSize
    );
    
    // Draw grid
    ctx.strokeStyle = '#e0e0e0'; // Light gray borders
    ctx.lineWidth = 1;
    
    // Draw vertical lines
    for (let x = 0; x <= gridSize; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, gridSize * cellSize);
      ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = 0; y <= gridSize; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(gridSize * cellSize, y * cellSize);
      ctx.stroke();
    }
    
    // Draw coordinates
    ctx.font = '10px Arial';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const canvasPos = gridToCanvas(x - center, center - y, cellSize);
        const colLabel = String.fromCharCode(65 + x); // A, B, C, ...
        const rowLabel = (y + 1).toString(); // 1, 2, 3, ...
        ctx.fillText(`${colLabel}${rowLabel}`, canvasPos.x + cellSize / 2, canvasPos.y + cellSize / 2);
      }
    }
    
    // Draw path
    if (path.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#4CAF50'; // Green path
      ctx.lineWidth = 3;
      
      const startPos = gridToCanvas(path[0].x, path[0].y, cellSize);
      ctx.moveTo(startPos.x + cellSize / 2, startPos.y + cellSize / 2);
      
      for (let i = 1; i < path.length; i++) {
        const pos = gridToCanvas(path[i].x, path[i].y, cellSize);
        ctx.lineTo(pos.x + cellSize / 2, pos.y + cellSize / 2);
      }
      
      ctx.stroke();
      
      // Draw path points
      for (let i = 0; i < path.length; i++) {
        const pos = gridToCanvas(path[i].x, path[i].y, cellSize);
        ctx.beginPath();
        ctx.arc(
          pos.x + cellSize / 2,
          pos.y + cellSize / 2,
          cellSize / 8,
          0,
          2 * Math.PI
        );
        ctx.fillStyle = '#2E7D32'; // Darker green for path points
        ctx.fill();
      }
    }
    
    // Draw robot
    const robotPos = gridToCanvas(currentPosition.x, currentPosition.y, cellSize);
    
    // Draw robot body (circle)
    ctx.beginPath();
    ctx.arc(
      robotPos.x + cellSize / 2,
      robotPos.y + cellSize / 2,
      cellSize / 3,
      0,
      2 * Math.PI
    );
    ctx.fillStyle = '#2196F3'; // Blue robot
    ctx.fill();
    
    // Draw direction indicator (arrow)
    ctx.save();
    ctx.translate(
      robotPos.x + cellSize / 2,
      robotPos.y + cellSize / 2
    );
    
    // Adjust rotation to match compass directions (0° is North)
    // Subtract 90 degrees to convert from compass to canvas coordinates
    ctx.rotate(((direction - 90) * Math.PI) / 180);
    
    ctx.beginPath();
    ctx.moveTo(0, -cellSize / 3);
    ctx.lineTo(cellSize / 4, 0);
    ctx.lineTo(-cellSize / 4, 0);
    ctx.closePath();
    ctx.fillStyle = '#FFF';
    ctx.fill();
    
    ctx.restore();
    
    // Draw coordinate text for current position
    ctx.font = '12px Arial';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(
      `(${currentPosition.x.toFixed(1)}, ${currentPosition.y.toFixed(1)})`,
      robotPos.x + cellSize / 2,
      robotPos.y - cellSize / 4
    );
    
    // Draw direction text
    ctx.textBaseline = 'top';
    ctx.fillText(
      `${direction.toFixed(0)}°`,
      robotPos.x + cellSize / 2,
      robotPos.y + cellSize / 2 + cellSize / 3
    );
  }, [currentPosition, path, direction, gridSize]);
  
  return (
    <div className="robot-map-container">
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        className="robot-map"
      />
      <div className="mt-2 text-sm text-gray-600 text-center">
        <p>Current Position: ({currentPosition.x.toFixed(1)}, {currentPosition.y.toFixed(1)})</p>
        <p>Direction: {direction.toFixed(0)}° ({getDirectionName(direction)})</p>
      </div>
    </div>
  );
};

// Helper function to get direction name
const getDirectionName = (degrees: number): string => {
  const normalizedDegrees = ((degrees % 360) + 360) % 360;
  
  if (normalizedDegrees >= 337.5 || normalizedDegrees < 22.5) {
    return 'North';
  } else if (normalizedDegrees >= 22.5 && normalizedDegrees < 67.5) {
    return 'Northeast';
  } else if (normalizedDegrees >= 67.5 && normalizedDegrees < 112.5) {
    return 'East';
  } else if (normalizedDegrees >= 112.5 && normalizedDegrees < 157.5) {
    return 'Southeast';
  } else if (normalizedDegrees >= 157.5 && normalizedDegrees < 202.5) {
    return 'South';
  } else if (normalizedDegrees >= 202.5 && normalizedDegrees < 247.5) {
    return 'Southwest';
  } else if (normalizedDegrees >= 247.5 && normalizedDegrees < 292.5) {
    return 'West';
  } else {
    return 'Northwest';
  }
};

export default RobotMap; 