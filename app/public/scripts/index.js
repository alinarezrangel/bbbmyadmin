/*window.addEventListener("load", function()
{
	// First: get server host and
	var socket = io.connect('http://localhost:4567');
	socket.on("info", function(data)
	{
		$("#out").html(data);
	});
});*/
window.addEventListener("load", function()
{
	function makeOption(value, name)
	{
		return "<option value=\"" + value + "\">" + name + "</option>";
	}
	if(PARGS.errorCode != "")
	{
		$(".error").html("Error: " + ETABLE[parseInt(PARGS.errorCode)]);
	}
	if(PARGS.canceled == "1")
	{
		$(".error").html($(".error").html() + ", Tu usuario ha sido cancelado por un administrador");
	}
	$.get("/public?request=rooms", function(data)
	{
		var json = {};
		try
		{
			json = JSON.parse(data);
		}
		catch(err)
		{
			return;
		}
		$("#rooms").html("");
		for(var i = 0;i < json.rooms.length;i++)
		{
			var v = json.rooms[i].id;
			var n = json.rooms[i].name;
			$("#rooms").html($("#rooms").html() + makeOption(v, n));
		}
	});
});