interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = "Loading witness surfaces" }: LoadingStateProps) {
  return (
    <div className="state state--loading" role="status">
      <span className="loading-pulse" aria-hidden="true" />
      {label}
    </div>
  );
}
