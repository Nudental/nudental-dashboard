def patients_summary(
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    locationId: Optional[str] = Query(None),
    officeId: Optional[str] = Query(None),
):
    scope = officeId or locationId
    selected_locations = [resolve_location_id(locationId=value.strip()) for value in scope.split(',')] if scope else []
    if any(value not in VALID_LOCATION_IDS for value in selected_locations):
        raise HTTPException(status_code=422, detail="Select valid office locations.")
    loc_id = ','.join(dict.fromkeys(selected_locations)) or None
    try:
        svc = get_service()

        return svc.get_patients_summary(startDate, endDate, loc_id)
    except Exception as e:
        logger.exception("Error fetching patients summary")
        raise HTTPException(status_code=500, detail=str(e))

def appointments_summary(
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    locationId: Optional[str] = Query(None),
    officeId: Optional[str] = Query(None),
):
    scope = officeId or locationId
    selected_locations = [resolve_location_id(locationId=value.strip()) for value in scope.split(',')] if scope else []
    if any(value not in VALID_LOCATION_IDS for value in selected_locations):
        raise HTTPException(status_code=422, detail="Select valid office locations.")
    loc_id = ','.join(dict.fromkeys(selected_locations)) or None
    try:
        svc = get_service()
        return svc.get_appointments_summary(startDate, endDate, loc_id)
    except Exception as e:
        logger.exception("Error fetching appointments summary")
        raise HTTPException(status_code=500, detail=str(e))
