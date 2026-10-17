/** Pure program-arrival policy shared by a future Leaflet screen and API tests. */
export function punctuality({ now, programStart, programEnd, travelMinutes }) {
	if (!programStart || !programEnd) return { state: 'UNKNOWN', label: 'Schedule unavailable' };
	if (!Number.isFinite(travelMinutes) || travelMinutes < 0) return { state: 'UNKNOWN', label: 'Route unavailable' };
	const current = new Date(now).getTime();
	const start = new Date(programStart).getTime();
	const end = new Date(programEnd).getTime();
	if (![current, start, end].every(Number.isFinite) || end <= start) return { state: 'UNKNOWN', label: 'Schedule unavailable' };
	const arrival = current + travelMinutes * 60_000;
	if (current < start) return { state: arrival <= start ? 'ON_TIME' : 'LATE', arrivalAt: new Date(arrival).toISOString(), label: arrival <= start ? 'On Time 🟢' : 'Late 🟡' };
	if (current >= end) return { state: 'FINISHED', arrivalAt: new Date(arrival).toISOString(), label: 'Program finished' };
	return { state: arrival <= end ? 'DURING_PROGRAM' : 'AFTER_PROGRAM', arrivalAt: new Date(arrival).toISOString(), label: arrival <= end ? 'Arriving during program' : 'Arriving after it ends' };
}
