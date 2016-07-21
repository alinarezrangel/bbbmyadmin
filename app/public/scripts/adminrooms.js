window.addEventListener("load", function()
{
	if(PARGS.errorCode != "")
	{
		$("#error").html("Error: " + ETABLE[parseInt(PARGS.errorCode)]);
	}
	if((PARGS.errorBBB != "") && (typeof PARGS.errorBBB !== "undefined"))
	{
		$("#error").html("Error (BBB): " + PARGS.errorBBB);
	}
});