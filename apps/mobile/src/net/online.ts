// Is the device online? Pure rule for the banner, so it is unit-tested.

/** `null` = not known yet (the first reading is still on its way): show nothing rather than a false alarm. */
export const showOfflineBanner = (online: boolean | null): boolean => online === false;
