import '@testing-library/jest-dom';

// Mock HTMLCanvasElement for AgentNetwork and other canvas-using components
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => ({
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'bevel',
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    fill: () => {},
    stroke: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    arc: () => {},
    arcTo: () => {},
    rect: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: () => ({ width: 0 }),
    drawImage: () => {},
    createImageData: () => ({ data: [] }),
    getImageData: () => ({ data: [] }),
    putImageData: () => {},
    createLinearGradient: () => ({}),
    createRadialGradient: () => ({}),
    createPattern: () => ({}),
    rotate: () => {},
    scale: () => {},
    translate: () => {},
    transform: () => {},
    setTransform: () => {},
    save: () => {},
    restore: () => {},
    resetTransform: () => {},
  }),
});

Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
  value: () => 'data:image/png;base64,mock',
});
