var tip_dashboard = {
  dt: null,
  var: {
    hasInit: false,
    page: 1,
    page_size: 10,
    route_path: "",
    search: "",
    thermal_files_url: "/api/thermal-files/",
    data: [],
    breadcrumb: [],
    root: "",
    location: "",
  },

  init: function () {
    const _ = tip_dashboard;
    const params = new URL(document.location.toString()).searchParams;
    const route_path = params.get("route_path") ?? '';

    _.var.hasInit = false;
    _.var.page = params.get("page") ?? 1;
    _.var.page_size = params.get("size") ?? 10;
    _.var.route_path = route_path;
    _.var.search = params.get("search") ?? "";

    _.var.root = $("#route_path").val();
    _.var.location = window.location.href.split("?")[0];
    _.var.breadcrumb = route_path.split("/");

    _.renderBreadcrumb();

    // tip_dashboard.get_pending_imports();
    _.dt = $("#tip_dashboard table").DataTable({
      serverSide: true,
      ajax: function (data, callback, settings) {
        const routePathFromBreadcrum = _.var.breadcrumb
          .filter((b, i) => i > 0)
          .join("/");

        if (!_.var.hasInit) {
          _.var.hasInit = true;
        } else {
          _.var.page = data && data.start ? data.start / data.length + 1 : 1
          _.var.page_size = data?.length
          _.var.route_path = routePathFromBreadcrum
          _.var.search = data?.search?.value
        }
        
        _.get_folder_data(
          {
            page: _.var.page,
            page_size: _.var.page_size,
            route_path: _.var.route_path,
            search: _.var.search,
            draw: data?.draw,
          },
          function (response) {
            const { count, results } = response;
            callback({
              data: results,
              recordsTotal: count,
              recordsFiltered: count,
            });
          },
          function (error) {
            console.error(error);
            alert("There was an error fetching the files");
          }
        );
      },
      headerCallback: function (thead, data, start, end, display) {
        $(thead).addClass("table-light");
      },
      drawCallback: function (settings) {
        $("#tip_dashboard table .btn-download").on("click", function (e) {
          const filePath = $(this).data("path");
          
          tip_dashboard.downloadFile(
            filePath,
            (res, status, xhr) => {
              const blobObj = new Blob([res], { type: "application/x-7z-compressed" });
              const objectURL = URL.createObjectURL(blobObj);
              const a = document.createElement('a');
              a.href = objectURL
              a.setAttribute("download", `thermal_images_${new Date().toLocaleTimeString()}.7z`); 
              a.click()
            },
            (error) => {
              console.log("Failed to download file")
              console.error(error)
            }
          );
        });
      },
      columns: [
        {
          title: "Name",
          data: "name",
          render: function (data, type, row) {
            if (!row.is_dir) return utils.markup("span", data);
            const path = row.path.replace(_.var.root, "");
            const href =
              tip_dashboard.var.location +
              "?" +
              utils.make_query_params({ route_path: path });

            return utils.markup(
              "a",
              [
                utils.markup("i", "", { class: "bi bi-folder " }),
                `&nbsp;${data}&nbsp;`,
              ],
              {
                href: href,
                class:
                  "btn-folder link-opacity-50-hovericon-link icon-link-hover",
                "data-folder": `${path}${row.name}`,
                style: "--bs-icon-link-transform: translate3d(0, -.125rem, 0);",
              }
            );
          },
        },
        {
          title: "Created at",
          data: "created_at",
        },

        {
          title: "Size",
          data: "size",
          render: function (data, type, row) {
            return utils.markup("span", utils.formatFileSize(data ?? 0));
          },
        },
        {
          title: "Download",
          data: "path",
          render: function (data, type, row) {
            return utils.markup(
              "button",
              { tag: "i", class: "bi bi-download" },
              {
                class: "btn-download btn btn-outline-dark border border-0",
                "data-path": row.path,
              }
            );
          },
        },
      ],
    });


    _.dt.state({start: (_.var.page - 1) * _.var.page_size,
      page_size: _.var.page_size,
      route_path: _.var.route_path,
      // search: _.var.search
    }).draw(false);
  },

  renderBreadcrumb: function () {
    const breadcrumb = $("#dashboard-breadcrumb");
    breadcrumb.empty();
    const crumbs = tip_dashboard.var.breadcrumb ?? [];
    crumbs.unshift("");
    for (let i = 0; i < crumbs.length; i++) {
      const crumb = crumbs[i];
      const isActive = i === crumbs.length - 1;

      const href = isActive
        ? null
        : tip_dashboard.var.location +
          "?" +
          utils.make_query_params({ route_path: crumbs.slice(1, i + 1).join("/"), page :1, page_size: 10 });

      const options = {
        class: ["breadcrumb-item", isActive ? "active" : ""].join(" "),
        "data-folder": crumbs.slice(0, i + 1).join("/"),
      };
      if (isActive) options["aria-current"] = "page";
      breadcrumb.append(
        utils.markup(
          "li",

          isActive ? crumb : utils.markup("a", crumb || "root", { href }),
          options
        )
      );
    }
  },

  handle_folder_click: function (e) {
    const folder = $(this).data("folder");
    const _ = tip_dashboard;
    _.var.breadcrumb = folder.split("/");
    _.dt.draw(true);
  },

  get_folder_data: function (params, cb_success, cb_error) {
    const _params = {
      page: params?.page ?? tip_dashboard.var.page,
      page_size: params?.page_size ?? tip_dashboard.var.page_size,
      route_path: params?.route_path ?? "",
      search: params?.search ?? "",
    };
    const queryParams = utils.make_query_params(_params);
    history.replaceState(null, null, "?" + queryParams.toString());

    $.ajax({
      url:
        tip_dashboard.var.thermal_files_url +
        "list_thermal_folder_contents/?" +
        queryParams,
      method: "GET",
      dataType: "json",
      contentType: "application/json",
      success: cb_success,
      error: cb_error,
    });
  },
  downloadFile: function (filePath, cb_success, cb_error) {
    const queryParams = utils.make_query_params({
      file_path: filePath,
    });

    $.ajax({
      url: tip_dashboard.var.thermal_files_url + "download/?" + queryParams,
      method: "GET",
      
      xhrFields: {responseType: "blob",},
      success: cb_success,
      error: cb_error,
      xhr: function () {
        var xhr = new window.XMLHttpRequest();
        xhr.addEventListener("progress", handleEvent);
        return xhr;
      },
    });
  },
};

function handleEvent(e) {
  console.log('Tranference: ' + `${e.type}: ${e.loaded} bytes transferred\n`) 
}
