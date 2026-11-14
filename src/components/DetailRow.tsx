import React from 'react';

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
  badgeClass?: string;
  fullWidth?: boolean;
}

export function DetailRow({ label, value, mono, bold, badgeClass, fullWidth }: DetailRowProps) {
  return (
  <div className={`p-2.5 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-0.5 ${fullWidth ? 'col-span-2' : ''}`}>
    <span className="text-[9px] text-[#3A2522]/60 font-bold">{label}</span>
    {badgeClass ? (
      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${badgeClass}`}>{value}</span>
    ) : (
      <span className={`block ${mono ? 'font-mono' : ''} ${bold ? 'font-alexandria font-bold text-[#570A1B]' : 'font-bold text-[#3A2522]'}`}>
        {value}
      </span>
    )}
  </div>
  );
}