export const COLORS = {
  primary: '#3B82F6',
  primaryHover: '#2563EB',
  bg: '#0F172A',
  card: '#1E293B',
  border: '#334155',
  text: '#F8FAFC',
  textMuted: '#94A3B8',

  info: '#3B82F6',
  success: '#22C55E',
  warning: '#F59E0B',
  critical: '#EF4444',
}

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
}

export const RADIUS = {
  sm: '6px',
  md: '10px',
  lg: '14px',
}

export const SHADOW = {
  card: '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
}

export const TYPE = {
  pageTitle: { fontSize: '28px', fontWeight: 700, color: COLORS.text },
  sectionTitle: { fontSize: '20px', fontWeight: 600, color: COLORS.text },
  cardTitle: { fontSize: '16px', fontWeight: 600, color: COLORS.text },
  body: { fontSize: '14px', fontWeight: 400, color: COLORS.text },
  caption: { fontSize: '12px', fontWeight: 400, color: COLORS.textMuted },
}

export const CARD_STYLE = {
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.lg,
  padding: SPACING.lg,
  boxShadow: SHADOW.card,
}

export const BUTTON_BASE = {
  borderRadius: RADIUS.md,
  height: '42px',
  padding: `0 ${SPACING.lg}`,
  fontSize: '14px',
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
}

export const BUTTON_VARIANTS = {
  primary: { ...BUTTON_BASE, background: COLORS.primary, color: '#FFFFFF' },
  secondary: { ...BUTTON_BASE, background: COLORS.border, color: COLORS.text },
  danger: { ...BUTTON_BASE, background: COLORS.critical, color: '#FFFFFF' },
}
