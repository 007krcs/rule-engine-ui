import React from 'react';
import { render, screen } from '@testing-library/react';
import ScreensWorkspacePage from '../src/app/builder/screens/page';
import FlowWorkspacePage from '../src/app/builder/flow/page';
import RulesWorkspacePage from '../src/app/builder/rules/page';
import DataWorkspacePage from '../src/app/builder/data/page';
import ComponentsWorkspacePage from '../src/app/builder/components/page';
import DocsWorkspacePage from '../src/app/builder/docs/page';
import RepoWorkspacePage from '../src/app/builder/repo/page';
import JsonWorkspacePage from '../src/app/builder/json/page';

describe('builder workspaces routing', () => {
  it('renders Screens workspace', () => {
    render(<ScreensWorkspacePage />);
    expect(screen.getByText('Screens')).toBeInTheDocument();
  });

  it('renders Flow workspace', () => {
    render(<FlowWorkspacePage />);
    expect(screen.getByText('Flow')).toBeInTheDocument();
  });

  it('renders Rules workspace', () => {
    render(<RulesWorkspacePage />);
    expect(screen.getByText('Rules')).toBeInTheDocument();
  });

  it('renders Data workspace', () => {
    render(<DataWorkspacePage />);
    expect(screen.getByText('Data')).toBeInTheDocument();
  });

  it('renders Components workspace', () => {
    render(<ComponentsWorkspacePage />);
    expect(screen.getByText('Components')).toBeInTheDocument();
  });

  it('renders Docs workspace', () => {
    render(<DocsWorkspacePage />);
    expect(screen.getByText('Docs')).toBeInTheDocument();
  });

  it('renders Repo workspace', () => {
    render(<RepoWorkspacePage />);
    expect(screen.getByText('Repo')).toBeInTheDocument();
  });

  it('renders JSON workspace', () => {
    render(<JsonWorkspacePage />);
    expect(screen.getByText('JSON')).toBeInTheDocument();
  });
});
