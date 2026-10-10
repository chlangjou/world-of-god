extends SceneTree

const Session = preload("res://scripts/simulation/session.gd")

func _initialize() -> void:
	var sim = Session.new()
	sim.start()
	sim.advance_by(90 * sim.day_seconds())
	print("SMOKE: ", JSON.stringify(sim.stats()))
	print("ACTIVITIES: ", JSON.stringify(sim.individuals.activity_counts))
	print("HOMES: ", sim.settlements.towns[0].structures.size() if not sim.settlements.towns.is_empty() else 0)
	quit(0)
