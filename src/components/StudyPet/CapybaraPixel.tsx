import React from 'react';

interface CapybaraPixelProps {
  state: 'idle' | 'walk' | 'sleep' | 'happy';
  facingLeft: boolean;
}

export const CapybaraPixel: React.FC<CapybaraPixelProps> = ({ state, facingLeft }) => {
  return (
    <div
      className={`relative select-none pointer-events-none transition-transform duration-200 ${
        facingLeft ? '-scale-x-100' : 'scale-x-100'
      }`}
      style={{ width: 84, height: 68 }}
    >
      <svg
        viewBox="0 0 42 34"
        className="w-full h-full drop-shadow-md"
        style={{ shapeRendering: 'crispEdges' }}
      >
        {/* Shadow on ground */}
        <ellipse
          cx="21"
          cy="32"
          rx={state === 'sleep' ? '18' : '15'}
          ry="2"
          fill="rgba(0,0,0,0.25)"
        />

        {/* --- STATE: SLEEP --- */}
        {state === 'sleep' ? (
          <g className="animate-pulse duration-1000">
            {/* Lying flat body */}
            <rect x="6" y="16" width="28" height="12" rx="3" fill="#996536" />
            <rect x="8" y="18" width="24" height="8" fill="#b37e4c" />
            <rect x="6" y="24" width="28" height="4" fill="#73471f" />

            {/* Flat head */}
            <rect x="26" y="15" width="12" height="10" rx="2" fill="#996536" />
            <rect x="34" y="17" width="5" height="7" fill="#5e3816" />
            {/* Sleeping eye */}
            <rect x="30" y="18" width="3" height="1" fill="#261505" />
            {/* Nose */}
            <rect x="37" y="18" width="2" height="2" fill="#1c0f04" />
            {/* Folded ear */}
            <rect x="25" y="14" width="3" height="2" fill="#5e3816" />

            {/* Tiny resting paws */}
            <rect x="9" y="27" width="4" height="2" fill="#5e3816" />
            <rect x="23" y="27" width="4" height="2" fill="#5e3816" />

            {/* Resting orange on back */}
            <circle cx="16" cy="13" r="3.5" fill="#f97316" />
            <circle cx="15" cy="12" r="1" fill="#fdba74" />
            <rect x="15.5" y="9" width="1" height="1.5" fill="#15803d" />
            <ellipse cx="17" cy="9.5" rx="1.5" ry="0.8" fill="#22c55e" />
          </g>
        ) : (
          /* --- STANDING / WALKING / IDLE / HAPPY BODY --- */
          <g className={state === 'walk' ? 'animate-bounce duration-300' : state === 'happy' ? 'animate-bounce duration-200' : ''}>
            {/* Back Legs */}
            <g className={state === 'walk' ? 'animate-pulse' : ''}>
              <rect x="9" y="24" width="4" height="7" rx="1" fill="#73471f" />
              <rect x="9" y="30" width="5" height="2" fill="#4a2c11" />
            </g>

            {/* Main Body */}
            <rect x="7" y="12" width="25" height="15" rx="3" fill="#996536" />
            {/* Body Highlight / Texture */}
            <rect x="9" y="14" width="21" height="10" fill="#b37e4c" />
            <rect x="7" y="23" width="25" height="4" fill="#73471f" />

            {/* Front Legs */}
            <g className={state === 'walk' ? 'animate-pulse' : ''}>
              <rect x="23" y="24" width="4" height="7" rx="1" fill="#825127" />
              <rect x="23" y="30" width="5" height="2" fill="#4a2c11" />
            </g>

            {/* Big friendly Head & Snout */}
            <rect x="23" y="7" width="15" height="15" rx="3" fill="#996536" />
            <rect x="25" y="9" width="11" height="11" fill="#b37e4c" />

            {/* Distinctive Blocky Capybara Snout */}
            <rect x="31" y="11" width="8" height="10" rx="1" fill="#693d18" />
            <rect x="32" y="12" width="6" height="7" fill="#5e3816" />
            {/* Nostril */}
            <rect x="36" y="13" width="2" height="2" fill="#1c0f04" />

            {/* Eyes */}
            {state === 'happy' ? (
              /* Joyful curve eye ^ */
              <g>
                <path d="M 27 12 Q 28.5 10 30 12" stroke="#261505" strokeWidth="1.2" fill="none" />
                <rect x="33" y="18" width="3" height="1" fill="#e11d48" rx="0.5" />
              </g>
            ) : (
              /* Serene sleepy eye -.- */
              <g>
                <rect x="27" y="12" width="3.5" height="1.2" fill="#261505" />
                <rect x="28" y="11" width="1" height="0.5" fill="#4a2c11" />
              </g>
            )}

            {/* Ear */}
            <rect x="22" y="6" width="3.5" height="4" rx="1" fill="#693d18" />
            <rect x="23" y="7" width="1.5" height="2" fill="#4a2c11" />

            {/* Tiny cute tail */}
            <rect x="5" y="17" width="2.5" height="2" rx="1" fill="#73471f" />

            {/* Iconic Orange / Yuzu fruit on head */}
            <g transform="translate(26, 0)">
              <circle cx="4.5" cy="4.5" r="4" fill="#f97316" />
              <circle cx="3.5" cy="3" r="1.2" fill="#fdba74" />
              <circle cx="4.5" cy="4.5" r="3.8" stroke="#ea580c" strokeWidth="0.5" fill="none" />
              {/* Stem & Green Leaf */}
              <rect x="4" y="0" width="1" height="2" fill="#15803d" />
              <ellipse cx="6" cy="0.8" rx="2" ry="1" fill="#22c55e" />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};

