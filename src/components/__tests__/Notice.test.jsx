import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Notice from '../Notice';
import SectionHeader from '../SectionHeader';

describe('shared interface components', () => {
  it('announces a success message accessibly', () => {
    render(<Notice type="success">Cash shift saved</Notice>);
    expect(screen.getByRole('status')).toHaveTextContent('Cash shift saved');
    expect(screen.getByRole('status')).toHaveClass('notice-success');
  });

  it('renders a section title and description', () => {
    render(<SectionHeader eyebrow="REVENUE" title="Sales control" description="Track meter readings and collections." />);
    expect(screen.getByRole('heading', { level: 1, name: 'Sales control' })).toBeInTheDocument();
    expect(screen.getByText('Track meter readings and collections.')).toBeInTheDocument();
  });
});
