extends RefCounted

# Each implemented Miracle supplies its own parameters and kernel evaluators.
# Choosing/cancelling an area is presentation state, never a simulation command.
var catalog: Array = []
var selected_id: String = ""
var active_id: String = ""

func configure(definitions: Array, allowed: Array) -> void:
	cancel()
	catalog.clear()
	for entry in definitions:
		if entry.id in allowed: catalog.append(entry)
	selected_id = "" if catalog.is_empty() else catalog[0].id

func select(id_value: String) -> void:
	for entry in catalog:
		if entry.id == id_value:
			if selected_id != id_value: cancel()
			selected_id = id_value
			return

func definition(id_value: String) -> Dictionary:
	for entry in catalog:
		if entry.id == id_value: return entry
	return {}

func parameters(id_value: String) -> Dictionary:
	var entry = definition(id_value)
	if entry.is_empty(): return {}
	var command: Dictionary = entry.parameters.call().duplicate(true)
	command.type = id_value
	return command

func availability(sim) -> Dictionary:
	var entry = definition(selected_id)
	if entry.is_empty(): return {"ok": false, "reason": "目前沒有可用神蹟。", "cost": 0.0}
	return entry.availability.call(sim, parameters(selected_id))

func begin(sim) -> Dictionary:
	var result = availability(sim)
	if result.ok: active_id = selected_id
	return result

func cancel() -> void:
	active_id = ""

func command_at(center: Vector2) -> Dictionary:
	if active_id.is_empty(): return {}
	var command = parameters(active_id)
	command.x = center.x
	command.y = center.y
	return command

func preview(sim, center: Vector2) -> Dictionary:
	var entry = definition(active_id)
	if entry.is_empty(): return {"ok": false, "reason": "請先選擇神蹟。", "cost": 0.0}
	return entry.evaluate.call(sim, command_at(center))
