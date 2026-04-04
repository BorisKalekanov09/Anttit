import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SystemConsole from './SystemConsole';
import type { TickMessage } from '../types/simulation';

describe('SystemConsole', () => {
  it('should render without crashing', () => {
    const history: TickMessage[] = [];
    render(<SystemConsole history={history} />);
    const console = screen.getByTestId('system-console');
    expect(console).toBeDefined();
  });

  it('should display the console header', () => {
    const history: TickMessage[] = [];
    render(<SystemConsole history={history} />);
    expect(screen.getByText('SYSTEM CONSOLE')).toBeDefined();
  });
});
