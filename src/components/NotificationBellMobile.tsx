import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { getClientId, getNotifications, getUnreadCount, markNotificationAsRead, markAllNotificationsAsRead, listenForNotifications, Notification } from '../lib/clientId';

interface NotificationBellMobileProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const NotificationBellMobile: React.FC<NotificationBellMobileProps> = ({
  currentView,
  onNavigate
}) => {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Initialize notifications listener
  useEffect(() => {
    const clientId = getClientId();
    if (!clientId) return;

    // Initial load from localStorage
    const localNotifications = getNotifications();
    setNotifications(localNotifications);
    setUnreadCount(getUnreadCount());

    // Listen for real-time updates
    const unsubscribe = listenForNotifications(clientId, (updatedNotifications) => {
      setNotifications(updatedNotifications);
      setUnreadCount(updatedNotifications.filter(n => !n.read).length);
    });

    return unsubscribe;
  }, []);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      void markNotificationAsRead(notification.id);
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    setNotificationsOpen(false);
  };

  const handleMarkAllAsRead = () => {
    const clientId = getClientId();
    void markAllNotificationsAsRead(clientId);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleBellClick = () => {
    const next = !notificationsOpen;
    setNotificationsOpen(next);
    if (next && unreadCount > 0) {
      handleMarkAllAsRead();
    }
  };

  // Only show on home page
  if (currentView !== 'home') return null;

  return (
    <div className="fixed bottom-24 right-4 z-40">
      {/* Notification Bell Floating Button */}
      <div className="relative">
        <button
          onClick={handleBellClick}
          className="group relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#570A1B] via-[#731326] to-[#570A1B] text-white shadow-[0_8px_25px_rgba(87,10,27,0.45)] hover:brightness-105 hover:shadow-[0_12px_30px_rgba(87,10,27,0.55)] transition-all duration-300 border border-[#C6A16B]/40 active:scale-95"
          aria-label="الإشعارات"
        >
          {/* Bell Icon */}
          <Bell className="w-7 h-7 text-[#C6A16B] group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_4px_rgba(198,161,107,0.6)]" strokeWidth={2.2} />
          
          {/* Pulsing Red Dot - Only when unread > 0 */}
          {unreadCount > 0 && (
            <>
              {/* Outer pulsing ring */}
              <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-red-600/30 animate-ping" />
              {/* Inner solid dot with count */}
              <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(220,38,38,0.6)] animate-bounce-subtle">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </>
          )}
          
          {/* Subtle gold accent ring */}
          <span className="absolute inset-0 rounded-2xl border border-[#C6A16B]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </button>

        {/* Notifications Dropdown */}
        {notificationsOpen && (
          <div
            ref={notificationsRef}
            className="absolute right-0 bottom-full mb-4 w-86 bg-[#FFF9F1] border-2 border-[#C6A16B] rounded-3xl shadow-[0_20px_50px_rgba(30,2,8,0.35)] overflow-hidden z-50 animate-in fade-in-10 zoom-in-95 duration-300"
          >
            {/* Header with gradient background */}
            <div className="relative p-5 border-b border-[#C6A16B]/30 bg-gradient-to-r from-[#570A1B] via-[#731326] to-[#570A1B]">
              {/* Decorative gold accents */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(198,161,107,0.08)_0%,_transparent_70%)] pointer-events-none" />
              
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm text-[#C6A16B] flex items-center justify-center border border-[#C6A16B]/30 shadow-lg">
                    <Bell className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <h3 className="font-alexandria font-bold text-xl text-white drop-shadow-sm">الإشعارات</h3>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-sm text-white hover:text-[#C6A16B] font-semibold px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 transition-all duration-200"
                  >
                    قراءة الكل
                  </button>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-[65vh] overflow-y-auto bg-[#FFF9F1]">
              {notifications.length === 0 ? (
                <div className="relative p-10 space-y-4 text-center">
                  <div className="relative w-20 h-20 mx-auto bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400 rounded-2xl flex items-center justify-center shadow-inner">
                    <Bell className="w-10 h-10 text-white/80" strokeWidth={2} />
                  </div>
                  <div className="space-y-2 text-right">
                    <h4 className="font-alexandria font-bold text-lg text-[#570A1B]">لا توجد إشعارات</h4>
                    <p className="text-sm text-[#3A2522]/70 leading-relaxed">
                      ستظهر إشعارات تأكيد الحجز هنا
                    </p>
                    <p className="text-xs text-[#C6A16B] font-medium">
                      عند تأكيد المالك لحجزك، سيظهر إشعار هنا
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-[#C6A16B]/15">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`w-full p-5 text-right hover:bg-gradient-to-r hover:from-[#F3E2CC]/60 hover:to-[#ebd3b5]/60 transition-all duration-200 relative ${
                        !notification.read ? 'bg-white/80' : 'bg-transparent'
                      }`}
                    >
                      {/* Unread indicator bar on right */}
                      {!notification.read && (
                        <span className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#C6A16B] to-[#ebd3b5] rounded-l-full" />
                      )}
                      
                      <div className="flex items-start gap-4 relative">
                        {/* Type Icon Container */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                          notification.type === 'booking_confirmed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                          notification.type === 'booking_cancelled' ? 'bg-red-50 text-red-600 border border-red-200' :
                          notification.type === 'booking_completed' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                          'bg-amber-50 text-amber-600 border border-amber-200'
                        }`}>
                          {notification.type === 'booking_confirmed' && (
                            <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {notification.type === 'booking_cancelled' && (
                            <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          {notification.type === 'booking_completed' && (
                            <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          {notification.type === 'booking_pending' && (
                            <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          {notification.type === 'general' && (
                            <Bell className="w-7 h-7 text-amber-600" strokeWidth={2} />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`font-alexandria font-bold text-base leading-tight ${!notification.read ? 'text-[#570A1B]' : 'text-[#3A2522]/80'}`}>
                              {notification.title}
                            </h4>
                            {!notification.read && (
                              <span className="w-2.5 h-2.5 rounded-full bg-[#C6A16B] shrink-0 mt-0.5 animate-pulse" />
                            )}
                          </div>
                          <p className="text-sm text-[#3A2522]/75 leading-relaxed line-clamp-3">
                            {notification.message}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#3A2522]/55">
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {new Date(notification.createdAt).toLocaleDateString('ar-SA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {notification.bookingNumber && (
                              <span className="font-mono bg-gradient-to-r from-[#F3E2CC] to-[#ebd3b5] px-2.5 py-1 rounded-lg text-[#570A1B] border border-[#C6A16B]/30 shadow-sm">
                                {notification.bookingNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};