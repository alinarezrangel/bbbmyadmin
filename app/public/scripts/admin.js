window.addEventListener("load", function()
{
	$.get("/data?request=name", function(data)
	{
		$("#name").html(data);
	});
	$.get("/data?request=adminconfigframe", function(html)
	{
		if(html == "403")
		{
			$("#adminconfig").html("<span class=\"text-color-red\">Error: " + ETABLE[ENOACCESS] + "</span>");
			return;
		}
		if(html == "500")
		{
			$("#adminconfig").html("<span class=\"text-color-red\">Error: " + ETABLE[EQUECAN] + "</span>");
			return;
		}
		$("#adminconfig").html(html);
		tabs();
	});
	$(".updaterrooms").click(function()
	{
		$("#roomsl").html("<li>Cargando</li>");
		$.get("/data?request=getrooms", function(data)
		{
			if(data == "403")
			{
				$("#roomsl").html("<li class=\"text-color-red\">" + ETABLE[ENOACCESS] + "</li>");
				return;
			}
			if(data == "500")
			{
				$("#roomsl").html("<span class=\"text-color-red\">Error: " + ETABLE[EQUECAN] + "</span>");
				return;
			}
			var rooms = JSON.parse(data);
			if(rooms.meetings.length == 0)
				$("#roomsl").html("<li>No hay salas</li>");
			else
				$("#roomsl").html("");
			rooms.meetings.forEach(function(i, j)
			{
				var li = "<li>";
				li += i.name + "@" + i.id;
				if(!i.running)
				{
					li += " <span class=\"text-color-red\">La sala no esta corriendo, le recomendamos borrarla</span>"
				}
				li += " <a href=\"/joinRoom?id=" + i.id + "\">Ingresar</a></li>";
				$("#roomsl").html($("#roomsl").html() + li);
			});
		});
	});
});