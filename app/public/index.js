
var ETABLE = [
	"Nombre de usuario o contraseña invalidos", // ENPINVALID
	"El usuario no existe o fue cancelado", // ENOUSER
	"Error del servidor al procesar la consulta", // ESERVER
	"Necesita haber iniciado sesión para acceder a esta caracteristica/página", // EUNOLOGGED
	"No posee los permisos necesarios para la acción", // ENOACCESS
	"Consulta cancelada", // EQUECAN
	"Nombre de usuario no valido", // EUNAME
	"Nombre o contraseña demasiado largas", // ETOOLONG
	"Identificador inválido para la sala", // EINVID
	"Fecha inválido para la sala", // EINVDATE
	"Solicitudes binarias invalidas" // EINVBIN
];

var PARGS = {};

var ENPINVALID = 0;
var ENOUSER = 1;
var ESERVER = 2;
var EUNOLOGGED = 3;
var ENOACCESS = 4;
var EQUECAN = 5;
var EUNAME = 6;
var ETOOLONG = 7;
var EINVID = 8;
var EINVDATE = 9;
var EINVBIN = 10;

var onload = function(){};

function tabs()
{
	$(".tab.first").show();
	$(".tab-opener[data-open-tab]").click(function()
	{
		var tab = $(this).attr("data-open-tab");
		var pname = tab.split(".");
		var t = pname.slice(0, pname.length - 1).join(".");
		var d = $(".tab");
		for(var i = 0;i < d.length;i++)
		{
			var tname = $(d[i]).attr("data-tab-name");
			console.log("Try to match " + tab + " to " + t + " in " + tname);
			if(tname.startsWith(t))
			{
				$(d[i]).hide();
			}
		}
		$(".tab[data-tab-name=\"" + tab + "\"]").show();
	});
}

function init()
{
	$(".tab").hide();
	$(".tab.first").show();
	tabs();
	var defargs = {
		"startAtScreen": "",
		"errorData": null,
		"errorCode": ""
	};
	PARGS = (function(rss)
	{
		var url = location.href.replace("#", "");
		var args = url.split("?").slice(1).join("?");
		var r = args.split("&");
		var rs = rss;
		var i = 0;
		var l = r.length;
		for(i = 0;i < l;i++)
		{
			var w = r[i].split("=");
			rs[decodeURI(w[0])] = decodeURI(w[1]);
		}
		return rs;
	}(defargs));
	//$(".tab").css({"display": "none"});
	if(PARGS.startAtScreen != "")
	{
		$(".tab").hide();
		$(".tab-opener[data-open-tab=\"" + PARGS.startAtScreen + "\"]").trigger('click');
	}
	onload();
}

window.addEventListener("load", function()
{
	init();
});
