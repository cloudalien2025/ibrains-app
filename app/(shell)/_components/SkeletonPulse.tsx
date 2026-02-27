type SkeletonPulseProps = {
  className?: string;
};

export default function SkeletonPulse({ className = "" }: SkeletonPulseProps) {
  return (
    <div className={`animate-pulse rounded-full bg-white/10 ${className}`} />
  );
}
