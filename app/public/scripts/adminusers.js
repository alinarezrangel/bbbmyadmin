var pgindex = 0;
$("#ant").click(function()
{
	pgindex -= 1;
	if(pgindex < 0)
	{
		pgindex = 0;
	}
	$("#cur").html(pgindex);
	getUsers();
});
$("#sig").click(function()
{
	pgindex += 1;
	$("#cur").html(pgindex);
	getUsers();
});
function getUsers()
{
	$.get("/data?request=allusers&page=" + (pgindex * 20), function(json)
	{
		if(json == "403")
		{
			$("#userstd").html("<tr><td><span class=\"text-color-red\">Error: " + ETABLE[ENOACCESS] + "</span></td></tr>");
			return;
		}
		if(json == "500")
		{
			$("#userstd").html("<tr><td><span class=\"text-color-red\">Error: " + ETABLE[EQUECAN] + "</span></td></tr>");
			return;
		}
		json = JSON.parse(json);
		var html = "";
		for(var i = 0;i < json.users.length;i++)
		{
			var j = json.users[i];
			html += "<tr><td>";
			html += j.name;
			html += "</td><td>";
			html += j.lastname;
			html += "</td><td>";
			html += j.ci;
			html += "</td><td>";
			html += j.rolev + " (" + j.role + ")";
			html += "</td><td>";
			html += j.lastaccess;
			html += "</td><td><a href=\"/manageusers?get=user&username=" + encodeURI(j.username) + "\">";
			html += j.username;
			html += "</a></td><td>";
			html += j.nextroom + "@" + j.nextroomid;
			html += "</td></tr>";
		}
		$("#userstd").html(html);
	});
}
getUsers();