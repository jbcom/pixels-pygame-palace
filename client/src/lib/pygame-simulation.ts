interface GameObject {
  type: string;
  x: number;
  y: number;
  color: string;
  size: number;
}

interface SimulationResult {
  fps: number;
  objects: GameObject[];
}

export function simulatePygame(code: string): SimulationResult {
  const result: SimulationResult = {
    fps: 60,
    objects: []
  };

  // Simple simulation based on code analysis
  try {
    // Extract basic pygame drawing commands from code
    const lines = code.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Look for circle drawing
      if (trimmed.includes('pygame.draw.circle') || trimmed.includes('draw.circle')) {
        const match = trimmed.match(/circle\([^,]+,\s*([^,]+),\s*\(([^,]+),\s*([^)]+)\),\s*([^)]+)/);
        if (match) {
          const x = parseFloat(match[2]) || 400;
          const y = parseFloat(match[3]) || 300;
          const radius = parseFloat(match[4]) || 25;
          
          result.objects.push({
            type: 'circle',
            x: x,
            y: y,
            color: getColorFromCode(line, '#0066FF'),
            size: radius
          });
        } else {
          // Default circle if we can't parse exactly
          result.objects.push({
            type: 'circle',
            x: 400,
            y: 300,
            color: '#0066FF',
            size: 25
          });
        }
      }
      
      // Look for rectangle drawing
      if (trimmed.includes('pygame.draw.rect') || trimmed.includes('draw.rect')) {
        result.objects.push({
          type: 'rect',
          x: 300,
          y: 200,
          color: '#FF0000',
          size: 50
        });
      }
    }
    
    // If movement variables are present, simulate animation
    if (code.includes('speed') || code.includes('velocity')) {
      result.objects = result.objects.map(obj => ({
        ...obj,
        x: obj.x + (Math.sin(Date.now() / 1000) * 50),
        y: obj.y + (Math.cos(Date.now() / 1000) * 30)
      }));
    }
    
  } catch (error) {
    console.warn('Error simulating pygame code:', error);
  }

  return result;
}

function getColorFromCode(line: string, defaultColor: string): string {
  // Simple color detection
  if (line.includes('BLUE') || line.includes('(0, 100, 255)')) return '#0066FF';
  if (line.includes('RED') || line.includes('(255, 0, 0)')) return '#FF0000';
  if (line.includes('GREEN') || line.includes('(0, 255, 0)')) return '#00FF00';
  if (line.includes('WHITE') || line.includes('(255, 255, 255)')) return '#FFFFFF';
  if (line.includes('BLACK') || line.includes('(0, 0, 0)')) return '#000000';
  if (line.includes('YELLOW') || line.includes('(255, 255, 0)')) return '#FFFF00';
  
  return defaultColor;
}
