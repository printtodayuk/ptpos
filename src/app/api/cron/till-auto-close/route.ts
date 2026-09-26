import { NextResponse } from 'next/server';
import { autoCreateAllPendingTillJids, sweepPreviousDaysUnassignedTill } from '@/lib/server-actions-jobs';
import { formatLondonDateTime, getLondonCurrentDate, getLondonTimeParts } from '@/lib/london-time';

export const dynamic = 'force-dynamic';

/**
 * Endpoint called at 23:59 London time (or periodically via cron)
 * to automatically bundle any unassigned Till transactions into Paid Job Sheets
 * strictly created against "Walking Client".
 */
export async function GET() {
  try {
    const londonParts = getLondonTimeParts();
    
    // 1. Sweep any past unclosed London days
    const sweepResult = await sweepPreviousDaysUnassignedTill();

    // 2. Auto-close today's London till into Walking Client JIDs
    const autoCloseResult = await autoCreateAllPendingTillJids({
      targetDate: getLondonCurrentDate(),
      operator: 'PTTill (Auto Cron 23:59)',
    });

    return NextResponse.json({
      success: true,
      timestampLondon: formatLondonDateTime(),
      londonDate: londonParts.dateStr,
      londonHour: londonParts.hour,
      londonMinute: londonParts.minute,
      sweepResult,
      autoCloseResult,
    });
  } catch (error) {
    console.error('Error in till-auto-close cron route:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
