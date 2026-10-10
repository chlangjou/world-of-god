extends Control

const Session = preload("res://scripts/simulation/session.gd")
var sim = Session.new()

func _ready() -> void:
	sim.start()
	var label = Label.new()
	label.text = "World of God · MVP-0\nSimulation running. Presentation in development."
	add_child(label)

func _process(delta: float) -> void:
	sim.advance_wall(delta)
