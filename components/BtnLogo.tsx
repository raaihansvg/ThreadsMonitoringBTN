import React from "react";

export function BtnLogo({ className = "h-6 w-auto" }: { className?: string }) {
  return (
    <div className="flex h-9 items-center justify-center rounded-full bg-[#F4F7FB] px-2">
      <svg
        viewBox="0 0 130 55"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Logo Bank BTN"
      >
        {/* Huruf b */}
        <path
          d="M12 6H22V21.5C24.2 19.2 27.5 18 31.5 18C40.5 18 47 25 47 34.5C47 44 40.5 51 31.5 51C27.2 51 23.8 49.5 21.5 47V50H12V6ZM29.5 42.5C34.5 42.5 37.5 39.2 37.5 34.5C37.5 29.8 34.5 26.5 29.5 26.5C24.5 26.5 21.5 29.8 21.5 34.5C21.5 39.2 24.5 42.5 29.5 42.5Z"
          fill="#0055FF"
        />
        {/* Huruf t */}
        <path
          d="M58 10L68 7V19H76V27H68V38.5C68 41.2 69.5 42.2 72.2 42.2H76V50H70.5C61.8 50 58 46.5 58 38.5V27H52V19H58V10Z"
          fill="#0055FF"
        />
        {/* Huruf n */}
        <path
          d="M84 19H93.5V23.2C95.8 19.8 99.5 18 104.5 18C112.5 18 117.5 23.2 117.5 31.5V50H107.5V33C107.5 28.5 105 26.2 101 26.2C96.8 26.2 94 28.8 94 33.5V50H84V19Z"
          fill="#0055FF"
        />
        {/* Garis Atap Merah di atas huruf n */}
        <path
          d="M83 13.5L117 3.5C118.2 3.2 119 4.1 118.8 5.3L118 9.2C117.7 10.2 116.9 10.9 115.8 11.1L83.5 16.5C82.4 16.7 81.8 15.8 82.1 14.8L83 13.5Z"
          fill="#E60012"
        />
      </svg>
    </div>
  );
}
