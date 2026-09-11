import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { notificationEventsService } from '../services/notificationEventsService';

const SESSION_KEY = 'birthday_check_done';
const SESSION_NOTIF_KEY = 'birthday_notif_sent';

/**
 * Returns the sessionStorage key used to dismiss the other-staff birthday banner
 * for the current calendar date. Format: birthday_staff_banner_dismissed_YYYY-MM-DD
 */
const getStaffBannerDismissKey = () => {
  const today = new Date();
  const yyyy = today?.getFullYear();
  const mm = String(today?.getMonth() + 1)?.padStart(2, '0');
  const dd = String(today?.getDate())?.padStart(2, '0');
  return `birthday_staff_banner_dismissed_${yyyy}-${mm}-${dd}`;
};

/**
 * useBirthdayCheck — runs once per login session after user + profile are loaded.
 *
 * V722: Birthday source changed from user_profiles.date_of_birth
 *       to staff_directory.date_of_birth, matched by email.
 *
 * V723: Other-staff birthday banner enabled.
 *       Queries staff_directory for active staff with today's month/day birthday,
 *       excluding the logged-in user's own record.
 *       Shows first name only (or directory_display_name if first_name unavailable).
 *       sessionStorage dismissal key: birthday_staff_banner_dismissed_YYYY-MM-DD
 *
 * Returns:
 *   - showOwnBirthdayModal: boolean
 *   - staffBirthdays: string[]  — first names of other staff with birthday today
 *   - dismissOwnModal: () => void
 *   - dismissStaffBanner: () => void
 *   - showStaffBanner: boolean
 */
const useBirthdayCheck = ({ user, userProfile }) => {
  const [showOwnBirthdayModal, setShowOwnBirthdayModal] = useState(false);
  const [staffBirthdays, setStaffBirthdays] = useState([]);
  const [showStaffBanner, setShowStaffBanner] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    // Only run once per session, and only when user + profile are loaded
    if (!user?.id || !userProfile?.id) return;
    if (checkedRef?.current) return;

    // Check sessionStorage to avoid re-running on navigation
    const alreadyDone = sessionStorage?.getItem(SESSION_KEY);
    if (alreadyDone) return;

    checkedRef.current = true;
    sessionStorage?.setItem(SESSION_KEY, '1');

    const runCheck = async () => {
      try {
        const today = new Date();
        const todayMonth = today?.getMonth() + 1; // 1-12
        const todayDay = today?.getDate();

        // --- V722: Look up own birthday from staff_directory by email ---
        const userEmail = user?.email || userProfile?.email;

        if (!userEmail) {
          // No email available — cannot match safely; skip silently
          return;
        }

        // Query staff_directory matching any of the three email fields
        const { data: dirRecord, error: dirError } = await supabase
          ?.from('staff_directory')
          ?.select('date_of_birth, first_name, directory_display_name, preferred_email, work_email, personal_email')
          ?.or(
            `preferred_email.eq.${userEmail},work_email.eq.${userEmail},personal_email.eq.${userEmail}`
          )
          ?.eq('is_active', true)
          ?.limit(1)
          ?.maybeSingle();

        if (dirError) {
          console.warn('[useBirthdayCheck] staff_directory lookup error:', dirError?.message);
          return;
        }

        if (!dirRecord) {
          console.warn('[useBirthdayCheck] No staff_directory record found for email:', userEmail);
          return;
        }

        const ownDob = dirRecord?.date_of_birth; // format: YYYY-MM-DD
        if (!ownDob) {
          return;
        }

        // Match only month/day — ignore birth year entirely
        const [, dobMonth, dobDay] = ownDob?.split('-')?.map(Number);
        const isOwnBirthday = dobMonth === todayMonth && dobDay === todayDay;

        if (isOwnBirthday) {
          setShowOwnBirthdayModal(true);

          // Fire in-app notification + email/SMS (once per session)
          const notifAlreadySent = sessionStorage?.getItem(SESSION_NOTIF_KEY);
          if (!notifAlreadySent) {
            sessionStorage?.setItem(SESSION_NOTIF_KEY, '1');
            const firstName =
              dirRecord?.first_name ||
              userProfile?.full_name?.split(' ')?.[0] ||
              userProfile?.full_name ||
              'there';
            notificationEventsService?.onBirthdayDetected({
              userId: user?.id,
              userProfile,
              birthdayPersonName: firstName,
              isOwnBirthday: true,
            })?.catch(() => {});
          }
        }

        // --- V723: Other-staff birthday banner ---
        // Check if the banner was already dismissed for today
        const staffBannerDismissKey = getStaffBannerDismissKey();
        const bannerAlreadyDismissed = sessionStorage?.getItem(staffBannerDismissKey);
        if (bannerAlreadyDismissed) {
          // Banner was dismissed this session for today — do not show again
          return;
        }

        // Query all active staff with a non-null date_of_birth
        const { data: allStaff, error: staffError } = await supabase
          ?.from('staff_directory')
          ?.select('date_of_birth, first_name, directory_display_name, preferred_email, work_email, personal_email')
          ?.eq('is_active', true)
          ?.not('date_of_birth', 'is', null);

        if (staffError) {
          console.warn('[useBirthdayCheck] other-staff birthday lookup error:', staffError?.message);
          return;
        }

        if (!allStaff?.length) return;

        // Normalize the logged-in user's email for exclusion comparison
        const normalizedUserEmail = userEmail?.toLowerCase()?.trim();

        // Filter: today's month/day match, exclude the logged-in user's own record
        const otherBirthdayStaff = allStaff?.filter((staff) => {
          if (!staff?.date_of_birth) return false;

          // Exclude the logged-in user's own record by email
          const staffEmails = [
            staff?.preferred_email,
            staff?.work_email,
            staff?.personal_email,
          ]
            ?.filter(Boolean)
            ?.map((e) => e?.toLowerCase()?.trim());

          if (staffEmails?.includes(normalizedUserEmail)) return false;

          // Match month/day only — ignore birth year
          const parts = staff?.date_of_birth?.split('-')?.map(Number);
          if (parts?.length < 3) return false;
          const [, staffMonth, staffDay] = parts;
          return staffMonth === todayMonth && staffDay === todayDay;
        });

        if (!otherBirthdayStaff?.length) return;

        // Extract first name only (or directory_display_name as fallback)
        // Do NOT expose DOB, year, age, email, UUID, or internal ID
        const firstNames = otherBirthdayStaff?.map((staff) => {
          return staff?.first_name?.trim() || staff?.directory_display_name?.trim() || null;
        })?.filter(Boolean);

        if (!firstNames?.length) return;

        setStaffBirthdays(firstNames);
        setShowStaffBanner(true);

      } catch (err) {
        // Fail silently — birthday logic must never break the dashboard
        console.warn('[useBirthdayCheck] Birthday check failed silently:', err?.message);
      }
    };

    runCheck();
  }, [user?.id, userProfile?.id, user?.email, userProfile?.email]);

  const dismissOwnModal = () => setShowOwnBirthdayModal(false);

  const dismissStaffBanner = () => {
    setShowStaffBanner(false);
    // Persist dismissal for the rest of this calendar day's session
    const staffBannerDismissKey = getStaffBannerDismissKey();
    sessionStorage?.setItem(staffBannerDismissKey, '1');
  };

  return {
    showOwnBirthdayModal,
    staffBirthdays,
    showStaffBanner,
    dismissOwnModal,
    dismissStaffBanner,
  };
};

export default useBirthdayCheck;
