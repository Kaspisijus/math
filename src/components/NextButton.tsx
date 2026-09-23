interface Props {
  onClick: () => void;
}

// SPACE is handled globally; blocking mouse-down focus keeps a focused button from
// also reacting to SPACE and advancing twice.
export function NextButton({ onClick }: Props) {
  return (
    <button
      type="button"
      className="primary next-button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      Kitas (tarpas)
    </button>
  );
}
